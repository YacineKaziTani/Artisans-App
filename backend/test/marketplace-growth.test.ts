import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { Notification } from "../src/modules/notifications/notification.entities";
import { Favorite, FavoriteTargetType } from "../src/modules/favorites/favorite.entities";
import { Order, OrderPaymentStatus, OrderStatus } from "../src/modules/orders/order.entities";
import { Product } from "../src/modules/products/product.entities";
import { CustomRequest } from "../src/modules/custom-requests/custom-request.entities";
import { Message } from "../src/modules/messaging/message.entities";
import { Shop } from "../src/modules/shop/shop.entities";
import { notificationsSettled } from "../src/notifications/deliver";
import {
  TEST_PNG,
  api,
  authCookie,
  createProduct,
  createService,
  createShop,
  createUser,
  fakeStripe,
  resetDatabase,
  sendWebhook,
} from "./helpers";

const DAY = 864e5;

async function notificationsFor(userId: string) {
  await notificationsSettled();
  return AppDataSource.getRepository(Notification).find({ where: { user: { id: userId } }, order: { createdAt: "ASC" } });
}

/** The next whole hour at least `days` ahead, in UTC. */
function slot(days: number, hour = 10) {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

export function marketplaceGrowthTests() {
  describe("sale prices, featured products and follower alerts", () => {
    beforeEach(resetDatabase);

    it("only accepts a sale price above the real price, and caps featured products", async () => {
      const { owner } = await createShop();
      const cookie = authCookie(owner);
      const bad = await api().post("/api/products").set("Cookie", cookie).send({ title: "Mug", basePrice: 30, compareAtPrice: 25 });
      assert.equal(bad.status, 400);
      const ok = await api().post("/api/products").set("Cookie", cookie).send({ title: "Mug", basePrice: 30, compareAtPrice: 40 });
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      assert.equal(Number(ok.body.compareAtPrice), 40);
      // Lowering the "was" price under the price is refused too.
      const lower = await api().put(`/api/products/${ok.body.id}`).set("Cookie", cookie).send({ compareAtPrice: 20 });
      assert.equal(lower.status, 400);
      // Clearing it ends the sale.
      const cleared = await api().put(`/api/products/${ok.body.id}`).set("Cookie", cookie).send({ compareAtPrice: null });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.compareAtPrice, null);

      for (let i = 0; i < 6; i++) {
        await api().post("/api/products").set("Cookie", cookie).send({ title: `F${i}`, basePrice: 10, featured: true }).expect(201);
      }
      const seventh = await api().post("/api/products").set("Cookie", cookie).send({ title: "F7", basePrice: 10, featured: true });
      assert.equal(seventh.status, 400);
      assert.match(seventh.body.message, /at most 6/);
    });

    it("tells followers about a new product, at most once every few hours", async () => {
      const { shop, owner } = await createShop();
      const fan = await createUser();
      await AppDataSource.getRepository(Favorite).save({ user: fan, targetType: FavoriteTargetType.SHOP, targetId: shop.id });
      const cookie = authCookie(owner);
      await api().post("/api/products").set("Cookie", cookie).send({ title: "New vase", basePrice: 50 }).expect(201);
      await api().post("/api/products").set("Cookie", cookie).send({ title: "Another vase", basePrice: 50 }).expect(201);
      const notes = await notificationsFor(fan.id);
      assert.equal(notes.length, 1);
      assert.match(notes[0].title, /New from .*New vase/);
      assert.equal((await notificationsFor(owner.id)).length, 0, "the owner isn't their own follower");
    });
  });

  describe("discount codes", () => {
    beforeEach(resetDatabase);

    it("lets an artisan create codes, and checks them before checkout", async () => {
      const { shop, owner } = await createShop();
      const cookie = authCookie(owner);
      const created = await api().post("/api/discounts").set("Cookie", cookie).send({ code: "spring10", kind: "percent", value: 10 });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.code, "SPRING10");
      assert.equal(created.body.uses, 0);
      const dup = await api().post("/api/discounts").set("Cookie", cookie).send({ code: "Spring10", kind: "amount", value: 5 });
      assert.equal(dup.status, 409);
      const badPercent = await api().post("/api/discounts").set("Cookie", cookie).send({ code: "HUGE", kind: "percent", value: 95 });
      assert.equal(badPercent.status, 400);

      const client = authCookie(await createUser());
      const check = await api().post("/api/discounts/check").set("Cookie", client).send({ shopId: shop.id, code: "spring10", subtotal: 80 });
      assert.deepEqual(check.body, { valid: true, code: "SPRING10", kind: "percent", discount: 8, freeDelivery: false });
      const wrong = await api().post("/api/discounts/check").set("Cookie", client).send({ shopId: shop.id, code: "nope", subtotal: 80 });
      assert.equal(wrong.body.valid, false);
      // Codes belong to one shop.
      const { shop: other } = await createShop();
      const elsewhere = await api().post("/api/discounts/check").set("Cookie", client).send({ shopId: other.id, code: "spring10", subtotal: 80 });
      assert.equal(elsewhere.body.valid, false);
    });

    it("takes a percent code off a single order and charges the reduced amount", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop, { basePrice: 40 });
      await api().post("/api/discounts").set("Cookie", authCookie(owner)).send({ code: "TEN", kind: "percent", value: 10 }).expect(201);
      const res = await api()
        .post("/api/orders")
        .set("Cookie", authCookie(await createUser()))
        .send({ productId: product.id, quantity: 2, discountCode: "ten" });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(Number(res.body.order.totalAmount), 72);
      assert.equal(Number(res.body.order.discountAmount), 8);
      assert.equal(res.body.order.discountCode, "TEN");
      assert.equal(fakeStripe.latestIntent()!.amount, 7200);
    });

    it("splits an amount code across cart lines so they add up exactly", async () => {
      const { shop, owner } = await createShop();
      const a = await createProduct(shop, { basePrice: 10 });
      const b = await createProduct(shop, { basePrice: 20 });
      await api().post("/api/discounts").set("Cookie", authCookie(owner)).send({ code: "FIVE", kind: "amount", value: 5 }).expect(201);
      const res = await api()
        .post("/api/orders/checkout")
        .set("Cookie", authCookie(await createUser()))
        .send({ items: [{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 1 }], discountCode: "FIVE" });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const totals = res.body.orders.map((o: { totalAmount: string }) => Math.round(Number(o.totalAmount) * 100));
      assert.equal(totals.reduce((x: number, y: number) => x + y, 0), 2500);
      const discounts = res.body.orders.map((o: { discountAmount: string }) => Math.round(Number(o.discountAmount) * 100));
      assert.deepEqual(discounts.sort(), [167, 333]);
      assert.equal(fakeStripe.latestIntent()!.amount, 2500);
    });

    it("enforces the use limit, free delivery, minimum and expiry", async () => {
      const { shop, owner } = await createShop(undefined, { deliveryFee: 7, deliveryEnabled: true } as Partial<Shop>);
      const product = await createProduct(shop, { basePrice: 30 });
      const cookie = authCookie(owner);
      await api().post("/api/discounts").set("Cookie", cookie).send({ code: "ONCE", kind: "amount", value: 5, maxUses: 1 }).expect(201);
      await api().post("/api/discounts").set("Cookie", cookie).send({ code: "SHIPFREE", kind: "free_delivery", minSubtotal: 25 }).expect(201);
      await api()
        .post("/api/discounts")
        .set("Cookie", cookie)
        .send({ code: "OLD", kind: "amount", value: 5, startsAt: new Date(Date.now() - 2 * DAY).toISOString(), expiresAt: new Date(Date.now() - DAY).toISOString() })
        .expect(201);

      const buyer = authCookie(await createUser());
      const first = await api().post("/api/orders").set("Cookie", buyer).send({ productId: product.id, discountCode: "ONCE" });
      assert.equal(first.status, 201);
      await sendWebhook("payment_intent.amount_capturable_updated", fakeStripe.authorize(fakeStripe.latestIntent()!.id));
      const second = await api().post("/api/orders").set("Cookie", authCookie(await createUser())).send({ productId: product.id, discountCode: "ONCE" });
      assert.equal(second.status, 400);
      assert.match(second.body.message, /fully used/);

      const shipped = await api()
        .post("/api/orders")
        .set("Cookie", buyer)
        .send({ productId: product.id, discountCode: "shipfree", deliveryMethod: "delivery", shippingAddress: "1 Main St" });
      assert.equal(shipped.status, 201, JSON.stringify(shipped.body));
      assert.equal(Number(shipped.body.order.deliveryFee), 0);
      assert.equal(Number(shipped.body.order.totalAmount), 30);

      const cheap = await createProduct(shop, { basePrice: 10 });
      const tooSmall = await api().post("/api/orders").set("Cookie", buyer).send({ productId: cheap.id, discountCode: "SHIPFREE" });
      assert.equal(tooSmall.status, 400);
      const expired = await api().post("/api/orders").set("Cookie", buyer).send({ productId: product.id, discountCode: "OLD" });
      assert.equal(expired.status, 400);
      assert.match(expired.body.message, /expired/);
      // A refused code reserves nothing.
      assert.equal(await AppDataSource.getRepository(Order).count({ where: { product: { id: cheap.id } } }), 0);
    });
  });

  describe("custom orders (quotes)", () => {
    beforeEach(resetDatabase);

    const describeIt = "I'd love a set of six blue espresso cups with a speckled glaze.";

    it("runs request → quote → accept → paid order", async () => {
      const { shop, owner } = await createShop();
      const client = await createUser();
      const created = await api()
        .post("/api/custom-requests")
        .set("Cookie", authCookie(client))
        .send({ shopId: shop.id, description: describeIt, budget: 120 });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.status, "requested");
      assert.ok((await notificationsFor(owner.id)).some((n) => /Custom request/.test(n.title)));

      const photo = await api()
        .post(`/api/custom-requests/${created.body.id}/photos`)
        .set("Cookie", authCookie(client))
        .attach("image", TEST_PNG, "ref.png");
      assert.equal(photo.status, 200);
      assert.equal(photo.body.photos.length, 1);

      const stranger = await api().get(`/api/custom-requests/${created.body.id}`).set("Cookie", authCookie(await createUser()));
      assert.equal(stranger.status, 403);
      const early = await api().post(`/api/custom-requests/${created.body.id}/accept`).set("Cookie", authCookie(client)).send({});
      assert.equal(early.status, 400, "nothing to accept before a quote");

      const quoted = await api()
        .patch(`/api/custom-requests/${created.body.id}/quote`)
        .set("Cookie", authCookie(owner))
        .send({ price: 110, note: "Ready in two weeks" });
      assert.equal(quoted.status, 200, JSON.stringify(quoted.body));
      assert.equal(quoted.body.status, "quoted");
      assert.ok((await notificationsFor(client.id)).some((n) => /sent you a quote/.test(n.title)));

      const accepted = await api().post(`/api/custom-requests/${created.body.id}/accept`).set("Cookie", authCookie(client)).send({});
      assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
      assert.ok(accepted.body.clientSecret);
      assert.equal(accepted.body.order.productId, null);
      assert.match(accepted.body.order.title, /^Custom: /);
      assert.equal(fakeStripe.latestIntent()!.amount, 11000);

      await sendWebhook("payment_intent.amount_capturable_updated", fakeStripe.authorize(fakeStripe.latestIntent()!.id));
      const request = await AppDataSource.getRepository(CustomRequest).findOneByOrFail({ id: created.body.id });
      assert.equal(request.status, "accepted");
      // The artisan fulfils it like any order, and the card is charged.
      const order = await AppDataSource.getRepository(Order).findOneByOrFail({ id: accepted.body.order.id });
      assert.equal(order.paymentStatus, OrderPaymentStatus.AUTHORIZED);
      const fulfilled = await api().patch(`/api/orders/${order.id}/status`).set("Cookie", authCookie(owner)).send({ status: "fulfilled" });
      assert.equal(fulfilled.status, 200, JSON.stringify(fulfilled.body));
      const shopOrders = await api().get("/api/orders/shop").set("Cookie", authCookie(owner));
      assert.equal(shopOrders.status, 200);
    });

    it("replaces an unpaid checkout when the client accepts again, and lets either side close it", async () => {
      const { shop, owner } = await createShop();
      const client = await createUser();
      const id = (
        await api().post("/api/custom-requests").set("Cookie", authCookie(client)).send({ shopId: shop.id, description: describeIt })
      ).body.id;
      await api().patch(`/api/custom-requests/${id}/quote`).set("Cookie", authCookie(owner)).send({ price: 60 }).expect(200);
      const first = await api().post(`/api/custom-requests/${id}/accept`).set("Cookie", authCookie(client)).send({});
      const second = await api().post(`/api/custom-requests/${id}/accept`).set("Cookie", authCookie(client)).send({});
      assert.equal(second.status, 201);
      assert.equal(await AppDataSource.getRepository(Order).count({ where: { id: first.body.order.id } }), 0, "the first, unpaid one is gone");

      // A new quote invalidates the pending checkout for the old price.
      await api().patch(`/api/custom-requests/${id}/quote`).set("Cookie", authCookie(owner)).send({ price: 65 }).expect(200);
      assert.equal(await AppDataSource.getRepository(Order).count({ where: { id: second.body.order.id } }), 0);

      const withdrawn = await api().patch(`/api/custom-requests/${id}/cancel`).set("Cookie", authCookie(client));
      assert.equal(withdrawn.status, 200);
      assert.equal(withdrawn.body.status, "cancelled");

      const other = (
        await api().post("/api/custom-requests").set("Cookie", authCookie(client)).send({ shopId: shop.id, description: describeIt })
      ).body.id;
      const declined = await api().patch(`/api/custom-requests/${other}/decline`).set("Cookie", authCookie(owner)).send({ note: "Fully booked" });
      assert.equal(declined.body.status, "declined");
      assert.ok((await notificationsFor(client.id)).some((n) => /can't take on/.test(n.title)));
    });

    it("refuses requests to your own shop and too many open ones", async () => {
      const { shop, owner } = await createShop();
      const own = await api().post("/api/custom-requests").set("Cookie", authCookie(owner)).send({ shopId: shop.id, description: describeIt });
      assert.equal(own.status, 400);
      const client = authCookie(await createUser());
      for (let i = 0; i < 3; i++) {
        await api().post("/api/custom-requests").set("Cookie", client).send({ shopId: shop.id, description: describeIt }).expect(201);
      }
      const fourth = await api().post("/api/custom-requests").set("Cookie", client).send({ shopId: shop.id, description: describeIt });
      assert.equal(fourth.status, 429);
      const tooShort = await api().post("/api/custom-requests").set("Cookie", authCookie(await createUser())).send({ shopId: shop.id, description: "a mug" });
      assert.equal(tooShort.status, 400);
    });
  });

  describe("classes and workshops with places", () => {
    beforeEach(resetDatabase);

    it("lets several clients book the same session until it's full", async () => {
      const { shop } = await createShop();
      const workshop = await createService(shop, { capacity: 4, durationMinutes: 120, price: 30 });
      const at = slot(5).toISOString();
      const book = async (seats: number, scheduledAt = at) => {
        const res = await api().post("/api/bookings").set("Cookie", authCookie(await createUser())).send({ serviceId: workshop.id, scheduledAt, seats });
        if (res.status === 201) await sendWebhook("payment_intent.amount_capturable_updated", fakeStripe.authorize(fakeStripe.latestIntent()!.id));
        return res;
      };
      const a = await book(2);
      assert.equal(a.status, 201, JSON.stringify(a.body));
      assert.equal(Number(a.body.booking.totalAmount), 60);
      assert.equal(fakeStripe.latestIntent()!.amount, 6000);
      assert.equal((await book(1)).status, 201);
      const tooMany = await book(2);
      assert.equal(tooMany.status, 409);
      assert.match(tooMany.body.message, /Only 1 place left/);
      assert.equal((await book(1)).status, 201);
      const full = await book(1);
      assert.match(full.body.message, /full/);
      // Another start that overlaps the session is a clash.
      const overlap = await book(1, new Date(Date.parse(at) + 30 * 60_000).toISOString());
      assert.equal(overlap.status, 409);
      const over = await api().post("/api/bookings").set("Cookie", authCookie(await createUser())).send({ serviceId: workshop.id, scheduledAt: slot(6).toISOString(), seats: 5 });
      assert.equal(over.status, 400);
    });

    it("shows places left per session in availability", async () => {
      const { shop } = await createShop(undefined, {
        timezone: "UTC",
        openingHours: { mon: [{ open: "09:00", close: "17:00" }], tue: [{ open: "09:00", close: "17:00" }], wed: [{ open: "09:00", close: "17:00" }], thu: [{ open: "09:00", close: "17:00" }], fri: [{ open: "09:00", close: "17:00" }], sat: [{ open: "09:00", close: "17:00" }], sun: [{ open: "09:00", close: "17:00" }] },
      } as Partial<Shop>);
      const workshop = await createService(shop, { capacity: 3, durationMinutes: 60 });
      const at = slot(4, 10);
      await api().post("/api/bookings").set("Cookie", authCookie(await createUser())).send({ serviceId: workshop.id, scheduledAt: at.toISOString(), seats: 2 }).expect(201);
      const day = at.toISOString().slice(0, 10);
      const res = await api().get(`/api/services/${workshop.id}/availability?date=${day}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.capacity, 3);
      assert.ok(res.body.slots.includes(at.toISOString()), "the session with room left is still offered");
      assert.equal(res.body.seatsLeft[at.toISOString()], 1);
      const overlapping = new Date(at.getTime() + 30 * 60_000).toISOString();
      assert.ok(!res.body.slots.includes(overlapping));
    });
  });

  describe("holiday mode", () => {
    beforeEach(resetDatabase);

    it("pauses orders, moves bookings after the return date and auto-replies once", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop);
      const service = await createService(shop);
      const back = new Date(Date.now() + 10 * DAY);
      const on = await api().put("/api/shops/mine/holiday").set("Cookie", authCookie(owner)).send({ until: back.toISOString(), message: "Gone to the kiln fair!" });
      assert.equal(on.status, 200, JSON.stringify(on.body));

      const client = await createUser();
      const order = await api().post("/api/orders").set("Cookie", authCookie(client)).send({ productId: product.id });
      assert.equal(order.status, 400);
      assert.match(order.body.message, /away until/);
      const early = await api().post("/api/bookings").set("Cookie", authCookie(client)).send({ serviceId: service.id, scheduledAt: slot(3).toISOString() });
      assert.equal(early.status, 400);
      const later = await api().post("/api/bookings").set("Cookie", authCookie(client)).send({ serviceId: service.id, scheduledAt: slot(12).toISOString() });
      assert.equal(later.status, 201, JSON.stringify(later.body));

      const convo = await api().post("/api/conversations").set("Cookie", authCookie(client)).send({ shopId: shop.id });
      await api().post(`/api/conversations/${convo.body.id}/messages`).set("Cookie", authCookie(client)).send({ content: "Hello!" }).expect(201);
      await api().post(`/api/conversations/${convo.body.id}/messages`).set("Cookie", authCookie(client)).send({ content: "Still there?" }).expect(201);
      const auto = await AppDataSource.getRepository(Message).find({ where: { conversation: { id: convo.body.id }, isAutomatic: true } });
      assert.equal(auto.length, 1);
      assert.match(auto[0].content, /kiln fair/);

      const off = await api().put("/api/shops/mine/holiday").set("Cookie", authCookie(owner)).send({ until: null });
      assert.equal(off.status, 200);
      assert.equal((await api().post("/api/orders").set("Cookie", authCookie(client)).send({ productId: product.id })).status, 201);
    });
  });

  describe("artisan tools: calendar, stock alerts, analytics, CSV, chat", () => {
    beforeEach(resetDatabase);

    it("serves bookings as a private calendar feed whose link can be reset", async () => {
      const { shop, owner } = await createShop();
      const service = await createService(shop, { name: "Wheel lesson" });
      await api().post("/api/bookings").set("Cookie", authCookie(await createUser())).send({ serviceId: service.id, scheduledAt: slot(4).toISOString() }).expect(201);
      await sendWebhook("payment_intent.amount_capturable_updated", fakeStripe.authorize(fakeStripe.latestIntent()!.id));

      const { body } = await api().get("/api/shops/mine/calendar").set("Cookie", authCookie(owner)).expect(200);
      const feedPath = new URL(body.url).pathname;
      const feed = await api().get(feedPath);
      assert.equal(feed.status, 200);
      assert.match(feed.headers["content-type"], /text\/calendar/);
      assert.match(feed.text, /BEGIN:VCALENDAR/);
      assert.match(feed.text, /SUMMARY:Wheel lesson/);
      assert.match(feed.text, /STATUS:TENTATIVE/);

      const reset = await api().post("/api/shops/mine/calendar/reset").set("Cookie", authCookie(owner)).expect(200);
      assert.notEqual(reset.body.url, body.url);
      assert.equal((await api().get(feedPath)).status, 404);
      assert.equal((await api().get("/api/calendar/not-a-token.ics")).status, 404);
      // The token is never in shop JSON.
      const page = await api().get(`/api/shops/${shop.id}`);
      assert.equal(page.body.calendarToken, undefined);
    });

    it("warns the artisan once when a sale pushes stock to the alert level", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop, { stockQuantity: 4, title: "Teapot" });
      const client = await createUser();
      const buy = () => api().post("/api/orders").set("Cookie", authCookie(client)).send({ productId: product.id });
      await buy().expect(201); // 4 → 3: above the default level of 2
      assert.equal((await notificationsFor(owner.id)).filter((n) => /Low stock/.test(n.title)).length, 0);
      await buy().expect(201); // 3 → 2: crosses it
      await buy().expect(201); // 2 → 1: already below, no repeat
      const alerts = (await notificationsFor(owner.id)).filter((n) => /Low stock/.test(n.title));
      assert.equal(alerts.length, 1);
      assert.match(alerts[0].title, /Teapot/);
      await api().put("/api/shops/mine/stock-alerts").set("Cookie", authCookie(owner)).send({ lowStockThreshold: 0 }).expect(200);
    });

    it("counts product views (not the owner's or bots') and reports analytics", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop, { title: "Bowl" });
      await api().post(`/api/products/${product.id}/view`).expect(204);
      await api().post(`/api/products/${product.id}/view`).set("Cookie", authCookie(await createUser())).expect(204);
      await api().post(`/api/products/${product.id}/view`).set("Cookie", authCookie(owner)).expect(204);
      await api().post(`/api/products/${product.id}/view`).set("User-Agent", "Googlebot/2.1").expect(204);

      await AppDataSource.getRepository(Order).save(
        AppDataSource.getRepository(Order).create({
          client: await createUser(),
          shop,
          productId: product.id,
          quantity: 1,
          totalAmount: 25,
          status: OrderStatus.PENDING,
          paymentStatus: OrderPaymentStatus.AUTHORIZED,
        }),
      );

      const res = await api().get("/api/shops/mine/analytics?days=7").set("Cookie", authCookie(owner));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.series.length, 7);
      assert.equal(res.body.totals.views, 2);
      assert.equal(res.body.totals.orders, 1);
      assert.equal(res.body.totals.revenue, 25);
      assert.equal(res.body.totals.conversion, 50);
      assert.equal(res.body.topProducts[0].title, "Bowl");
    });

    it("exports the catalogue as CSV and imports changes all-or-nothing", async () => {
      const { shop, owner } = await createShop();
      const cookie = authCookie(owner);
      const mug = await createProduct(shop, { title: "=Mug", basePrice: 12, stockQuantity: 3 });

      const exported = await api().get("/api/products/mine/export").set("Cookie", cookie);
      assert.equal(exported.status, 200);
      assert.match(exported.text, /^id,title,description,price,compare_at_price,stock,featured/);
      assert.ok(exported.text.includes(`"'=Mug"`), "formula-like text is defused");

      const bad = await api()
        .post("/api/products/mine/import")
        .set("Cookie", cookie)
        .set("Content-Type", "text/csv")
        .send(`id,title,price,stock\n${mug.id},,15,2\n,New bowl,abc,\n`);
      assert.equal(bad.status, 400);
      assert.ok(bad.body.errors.some((e: string) => /Row 3/.test(e)));
      assert.equal(Number((await AppDataSource.getRepository(Product).findOneByOrFail({ id: mug.id })).basePrice), 12, "nothing changed");

      const good = await api()
        .post("/api/products/mine/import")
        .set("Cookie", cookie)
        .set("Content-Type", "text/csv")
        .send(`id,title,description,price,compare_at_price,stock\r\n${mug.id},'=Mug,"Glazed, by hand",15,20,untracked\r\n,New bowl,,22.5,,7\r\n`);
      assert.equal(good.status, 200, JSON.stringify(good.body));
      assert.deepEqual(good.body, { created: 1, updated: 1 });
      const updated = await AppDataSource.getRepository(Product).findOneByOrFail({ id: mug.id });
      assert.equal(updated.title, "=Mug");
      assert.equal(updated.description, "Glazed, by hand");
      assert.equal(Number(updated.compareAtPrice), 20);
      assert.equal(updated.stockQuantity, null);
      const bowl = await AppDataSource.getRepository(Product).findOneByOrFail({ title: "New bowl" });
      assert.equal(bowl.stockQuantity, 7);

      const { shop: otherShop } = await createShop();
      const theirs = await createProduct(otherShop);
      const hijack = await api().post("/api/products/mine/import").set("Cookie", cookie).set("Content-Type", "text/csv").send(`id,price\n${theirs.id},1\n`);
      assert.equal(hijack.status, 400, "can't edit another shop's product");
    });

    it("sends photos in chat and keeps quick replies", async () => {
      const { shop, owner } = await createShop();
      const client = await createUser();
      const convo = await api().post("/api/conversations").set("Cookie", authCookie(client)).send({ shopId: shop.id });
      const sent = await api()
        .post(`/api/conversations/${convo.body.id}/attachments`)
        .set("Cookie", authCookie(client))
        .field("content", "Like this one")
        .attach("image", TEST_PNG, "idea.png");
      assert.equal(sent.status, 201, JSON.stringify(sent.body));
      assert.equal(sent.body.attachments.length, 1);
      assert.equal(sent.body.content, "Like this one");
      const outsider = await api()
        .post(`/api/conversations/${convo.body.id}/attachments`)
        .set("Cookie", authCookie(await createUser()))
        .attach("image", TEST_PNG, "x.png");
      assert.equal(outsider.status, 403);

      const cookie = authCookie(owner);
      assert.deepEqual((await api().get("/api/users/mine/quick-replies").set("Cookie", cookie)).body, { replies: [] });
      const saved = await api().put("/api/users/mine/quick-replies").set("Cookie", cookie).send({ replies: ["Thanks!", " Thanks! ", "Ready Friday"] });
      assert.deepEqual(saved.body.replies, ["Thanks!", "Ready Friday"]);
      const tooMany = await api().put("/api/users/mine/quick-replies").set("Cookie", cookie).send({ replies: Array.from({ length: 21 }, (_, i) => `r${i}`) });
      assert.equal(tooMany.status, 400);
    });

    it("shows how fast a shop usually replies once there's enough history", async () => {
      const { shop, owner } = await createShop();
      const messages = AppDataSource.getRepository(Message);
      for (let i = 0; i < 3; i++) {
        const client = await createUser();
        const convo = await api().post("/api/conversations").set("Cookie", authCookie(client)).send({ shopId: shop.id });
        const asked = new Date(Date.now() - (i + 2) * DAY);
        await messages.save({ conversation: { id: convo.body.id }, sender: client, content: "Hi", createdAt: asked } as never);
        await messages.save({
          conversation: { id: convo.body.id },
          sender: owner,
          content: "Hello",
          createdAt: new Date(asked.getTime() + (i + 1) * 60 * 60_000),
        } as never);
      }
      const page = await api().get(`/api/shops/${shop.id}`).expect(200);
      assert.equal(page.body.stats.responseTimeMinutes, 120);
    });
  });
}

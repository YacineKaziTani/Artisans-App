import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { Order } from "../src/modules/orders/order.entities";
import { localParts, weekdayOf, zonedToUtc } from "../src/lib/schedule";
import {
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

const TZ = "Europe/Paris";

/** The next Monday at least 2 days away, as YYYY-MM-DD in the shop's zone. */
function nextMonday() {
  let d = new Date(Date.now() + 2 * 864e5);
  while (weekdayOf(localParts(d, TZ).date) !== "mon") d = new Date(d.getTime() + 864e5);
  return localParts(d, TZ).date;
}

const MON_HOURS = { mon: [{ open: "09:00", close: "12:00" }] };

export function shopSettingsTests() {
  describe("opening hours and time zones", () => {
    beforeEach(resetDatabase);

    it("validates and saves a shop's hours", async () => {
      const { owner } = await createShop();
      const cookie = authCookie(owner);

      const badZone = await api().put("/api/shops/mine/hours").set("Cookie", cookie)
        .send({ timezone: "Mars/Olympus", openingHours: MON_HOURS });
      assert.equal(badZone.status, 400);

      const overlap = await api().put("/api/shops/mine/hours").set("Cookie", cookie)
        .send({ timezone: TZ, openingHours: { mon: [{ open: "09:00", close: "12:00" }, { open: "11:00", close: "13:00" }] } });
      assert.equal(overlap.status, 400);

      const ok = await api().put("/api/shops/mine/hours").set("Cookie", cookie)
        .send({ timezone: TZ, openingHours: { ...MON_HOURS, tue: [] } });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.equal(ok.body.shop.timezone, TZ);
      assert.deepEqual(ok.body.shop.openingHours, MON_HOURS, "empty days are dropped");
    });

    it("offers only free slots inside the hours, and refuses bookings outside them", async () => {
      const { shop, owner } = await createShop();
      const service = await createService(shop, { durationMinutes: 60 });
      await api().put("/api/shops/mine/hours").set("Cookie", authCookie(owner))
        .send({ timezone: TZ, openingHours: MON_HOURS }).expect(200);
      const date = nextMonday();
      const client = authCookie(await createUser());

      const first = await api().get(`/api/services/${service.id}/availability?date=${date}`);
      assert.equal(first.status, 200);
      assert.equal(first.body.timezone, TZ);
      assert.deepEqual(
        first.body.slots,
        ["09:00", "09:30", "10:00", "10:30", "11:00"].map((t) => zonedToUtc(date, t, TZ).toISOString()),
      );

      const outside = await api().post("/api/bookings").set("Cookie", client)
        .send({ serviceId: service.id, scheduledAt: zonedToUtc(date, "11:30", TZ).toISOString() });
      assert.equal(outside.status, 400, "would run past closing");

      const booked = await api().post("/api/bookings").set("Cookie", client)
        .send({ serviceId: service.id, scheduledAt: first.body.slots[2] }); // 10:00
      assert.equal(booked.status, 201, JSON.stringify(booked.body));

      const after = await api().get(`/api/services/${service.id}/availability?date=${date}`);
      assert.deepEqual(
        after.body.slots,
        ["09:00", "11:00"].map((t) => zonedToUtc(date, t, TZ).toISOString()),
        "slots overlapping the 10:00–11:00 booking are gone",
      );

      const tuesday = await api().get(`/api/services/${service.id}/availability?date=${
        localParts(new Date(zonedToUtc(date, "12:00", TZ).getTime() + 864e5), TZ).date}`);
      assert.deepEqual(tuesday.body.slots, [], "closed on Tuesday");
    });

    it("keeps any-time requests for shops without hours", async () => {
      const { shop } = await createShop();
      const service = await createService(shop);
      const res = await api().get(`/api/services/${service.id}/availability?date=${nextMonday()}`);
      assert.equal(res.body.hasOpeningHours, false);

      const booked = await api().post("/api/bookings").set("Cookie", authCookie(await createUser()))
        .send({ serviceId: service.id, scheduledAt: zonedToUtc(nextMonday(), "22:15", TZ).toISOString() });
      assert.equal(booked.status, 201);
    });
  });

  describe("delivery options and fees", () => {
    beforeEach(resetDatabase);

    async function shopWithDelivery(settings: object) {
      const { shop, owner } = await createShop();
      const res = await api().put("/api/shops/mine/delivery").set("Cookie", authCookie(owner))
        .send({ pickupEnabled: true, deliveryEnabled: true, deliveryFee: 4.5, freeDeliveryOver: null, deliveryArea: "Paris", ...settings });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      return { shop, owner };
    }

    it("adds the delivery fee to the charge, and waives it over the threshold", async () => {
      const { shop } = await shopWithDelivery({ freeDeliveryOver: 50 });
      const product = await createProduct(shop, { basePrice: 20 });
      const cookie = authCookie(await createUser());

      const small = await api().post("/api/orders").set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1, deliveryMethod: "delivery", shippingAddress: "1 rue X" });
      assert.equal(small.status, 201, JSON.stringify(small.body));
      assert.equal(Number(small.body.order.totalAmount), 24.5);
      assert.equal(Number(small.body.order.deliveryFee), 4.5);
      assert.equal(fakeStripe.latestIntent()!.amount, 2450);

      const big = await api().post("/api/orders").set("Cookie", cookie)
        .send({ productId: product.id, quantity: 3, deliveryMethod: "delivery", shippingAddress: "1 rue X" });
      assert.equal(Number(big.body.order.totalAmount), 60, "free over $50");

      const pickup = await api().post("/api/orders").set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1, deliveryMethod: "pickup" });
      assert.equal(Number(pickup.body.order.totalAmount), 20);
    });

    it("charges delivery once per cart, on the first line", async () => {
      const { shop } = await shopWithDelivery({});
      const a = await createProduct(shop, { basePrice: 10 });
      const b = await createProduct(shop, { basePrice: 15 });
      const res = await api().post("/api/orders/checkout").set("Cookie", authCookie(await createUser()))
        .send({ items: [{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 2 }], deliveryMethod: "delivery", shippingAddress: "1 rue X" });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(fakeStripe.latestIntent()!.amount, 1000 + 3000 + 450);
      const fees = (await AppDataSource.getRepository(Order).find()).map((o) => Number(o.deliveryFee)).sort();
      assert.deepEqual(fees, [0, 4.5]);
    });

    it("refuses a method the shop doesn't offer, without reserving stock", async () => {
      const { shop } = await shopWithDelivery({ pickupEnabled: false });
      const product = await createProduct(shop, { stockQuantity: 2 });
      const res = await api().post("/api/orders").set("Cookie", authCookie(await createUser()))
        .send({ productId: product.id, quantity: 1, deliveryMethod: "pickup" });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /doesn't offer pickup/);
      const { owner } = await createShop();
      const neither = await api().put("/api/shops/mine/delivery").set("Cookie", authCookie(owner))
        .send({ pickupEnabled: false, deliveryEnabled: false, deliveryFee: 0 });
      assert.equal(neither.status, 400);
    });
  });

  describe("earnings", () => {
    beforeEach(resetDatabase);

    it("shows paid sales with the commission taken, and holds separately", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop, { basePrice: 40 });
      const cookie = authCookie(await createUser());

      // One paid order...
      const paid = await api().post("/api/orders").set("Cookie", cookie).send({ productId: product.id, quantity: 1 });
      await sendWebhook("payment_intent.amount_capturable_updated", fakeStripe.authorize(fakeStripe.latestIntent()!.id));
      await api().patch(`/api/orders/${paid.body.order.id}/status`).set("Cookie", authCookie(owner))
        .send({ status: "fulfilled" }).expect(200);
      // ...and one still on hold.
      await api().post("/api/orders").set("Cookie", cookie).send({ productId: product.id, quantity: 2 });
      await sendWebhook("payment_intent.amount_capturable_updated", fakeStripe.authorize(fakeStripe.latestIntent()!.id));

      const res = await api().get("/api/shops/mine/earnings").set("Cookie", authCookie(owner));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.commissionPercent, 10);
      assert.equal(res.body.totals.paidGross, 40);
      assert.equal(res.body.totals.paidNet, 36);
      assert.equal(res.body.totals.thisMonthNet, 36);
      assert.equal(res.body.totals.onHold, 80);
      assert.equal(res.body.meta.total, 2);
      assert.deepEqual(res.body.data.map((r: { net: number | null }) => r.net).sort(), [36, null].sort());
    });
  });
}

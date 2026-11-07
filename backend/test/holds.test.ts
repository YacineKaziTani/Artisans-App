import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { Order } from "../src/modules/orders/order.entities";
import { Booking } from "../src/modules/booking/booking.entities";
import { Product } from "../src/modules/products/product.entities";
import { sendOrderHoldReminders } from "../src/modules/orders/order.controller";
import { reconcileStaleHolds, sendBookingHoldReminders } from "../src/modules/booking/booking.controller";
import { notificationsSettled } from "../src/notifications/deliver";
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
  sentEmails,
} from "./helpers";

const DAY = 864e5;

/** A client's order, authorized through the webhook like a real checkout. */
async function authorizedOrder(stock = 3) {
  const { shop, owner } = await createShop();
  const product = await createProduct(shop, { stockQuantity: stock });
  const client = await createUser();
  const res = await api().post("/api/orders").set("Cookie", authCookie(client)).send({ productId: product.id, quantity: 1 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const intent = fakeStripe.authorize(fakeStripe.latestIntent()!.id);
  await sendWebhook("payment_intent.amount_capturable_updated", intent);
  return { shop, owner, product, client, intent, orderId: res.body.order.id as string };
}

const ageHold = (table: "orders" | "bookings", days: number) =>
  AppDataSource.query(`UPDATE ${table} SET "authorizedAt" = now() - ($1 || ' days')::interval`, [String(days)]);

export function holdTests() {
  describe("card holds that are about to lapse", () => {
    beforeEach(resetDatabase);

    it("records when the hold was placed, and reminds the artisan once around day 5", async () => {
      const { owner, orderId } = await authorizedOrder();
      const order = await AppDataSource.getRepository(Order).findOneByOrFail({ id: orderId });
      assert.ok(order.authorizedAt, "set by the authorization webhook");

      assert.equal(await sendOrderHoldReminders(), 0, "too early");
      await ageHold("orders", 5.5);
      assert.equal(await sendOrderHoldReminders(), 1);
      assert.equal(await sendOrderHoldReminders(), 0, "only once");
      await notificationsSettled();
      assert.ok(sentEmails.some((e) => e.to === owner.email && /expires soon/.test(e.subject)));
    });

    it("sends one reminder per checkout, not per item", async () => {
      const { shop, owner } = await createShop();
      const a = await createProduct(shop);
      const b = await createProduct(shop);
      await api().post("/api/orders/checkout").set("Cookie", authCookie(await createUser()))
        .send({ items: [{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 1 }] }).expect(201);
      await sendWebhook("payment_intent.amount_capturable_updated", fakeStripe.authorize(fakeStripe.latestIntent()!.id));
      await ageHold("orders", 6);
      assert.equal(await sendOrderHoldReminders(), 1);
      await notificationsSettled();
      assert.equal(sentEmails.filter((e) => e.to === owner.email && /expires soon/.test(e.subject)).length, 1);
    });

    it("tells both sides when Stripe drops an unfulfilled order's hold, and restocks", async () => {
      const { owner, client, product, intent, orderId } = await authorizedOrder(3);
      assert.equal((await AppDataSource.getRepository(Product).findOneByOrFail({ id: product.id })).stockQuantity, 2);

      intent.status = "canceled";
      await sendWebhook("payment_intent.canceled", intent).expect(200);
      await notificationsSettled();

      const order = await AppDataSource.getRepository(Order).findOneByOrFail({ id: orderId });
      assert.equal(order.status, "cancelled");
      assert.equal((await AppDataSource.getRepository(Product).findOneByOrFail({ id: product.id })).stockQuantity, 3);
      assert.ok(sentEmails.some((e) => e.to === client.email && /was cancelled/.test(e.subject) && /weren&#39;t charged|weren't charged/.test(e.html)));
      assert.ok(sentEmails.some((e) => e.to === owner.email && /Order expired/.test(e.subject)));
    });

    it("doesn't send 'expired' emails when someone cancelled on purpose", async () => {
      const { client, intent, orderId } = await authorizedOrder();
      await api().patch(`/api/orders/${orderId}/cancel`).set("Cookie", authCookie(client)).expect(200);
      await sendWebhook("payment_intent.canceled", intent).expect(200); // Stripe confirms our cancel
      await notificationsSettled();
      assert.ok(!sentEmails.some((e) => /expired|was cancelled/i.test(e.subject)));
    });

    it("handles bookings the same way: reminder, then expiry", async () => {
      const { shop, owner } = await createShop();
      const service = await createService(shop);
      const client = await createUser();
      const res = await api().post("/api/bookings").set("Cookie", authCookie(client))
        .send({ serviceId: service.id, scheduledAt: new Date(Date.now() + 10 * DAY).toISOString() });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const intent = fakeStripe.authorize(fakeStripe.latestIntent()!.id);
      await sendWebhook("payment_intent.amount_capturable_updated", intent);

      await ageHold("bookings", 5.5);
      assert.equal(await sendBookingHoldReminders(), 1);

      intent.status = "canceled";
      await sendWebhook("payment_intent.canceled", intent).expect(200);
      await notificationsSettled();
      const booking = await AppDataSource.getRepository(Booking).findOneByOrFail({ id: res.body.booking.id });
      assert.equal(booking.status, "cancelled");
      assert.ok(sentEmails.some((e) => e.to === owner.email && /confirm/.test(e.subject)));
      assert.ok(sentEmails.some((e) => e.to === client.email && /was cancelled/.test(e.subject)));
    });

    it("catches a lapsed hold even if Stripe's webhook never arrived", async () => {
      const { client, intent, orderId } = await authorizedOrder();
      await ageHold("orders", 8);
      intent.status = "canceled"; // Stripe dropped it, but we never heard

      assert.equal(await reconcileStaleHolds(), 1);
      await notificationsSettled();
      const order = await AppDataSource.getRepository(Order).findOneByOrFail({ id: orderId });
      assert.equal(order.status, "cancelled");
      assert.equal(order.paymentStatus, "unpaid");
      assert.ok(sentEmails.some((e) => e.to === client.email && /was cancelled/.test(e.subject)));
    });
  });
}

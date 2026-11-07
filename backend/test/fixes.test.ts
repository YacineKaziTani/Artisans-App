import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { Order } from "../src/modules/orders/order.entities";
import { Notification } from "../src/modules/notifications/notification.entities";
import { sweepUnpaidCheckouts } from "../src/jobs/expire-checkouts";
import { scrubEmails } from "../src/instrument";
import {
  api,
  authCookie,
  createProduct,
  createShop,
  createUser,
  fakeStripe,
  resetDatabase,
  sendWebhook,
} from "./helpers";

export function fixesTests() {
  describe("review fixes", () => {
    beforeEach(resetDatabase);

    it("still charges delivery when the line carrying the fee is cancelled but the rest ships", async () => {
      const { shop, owner } = await createShop();
      await api().put("/api/shops/mine/delivery").set("Cookie", authCookie(owner))
        .send({ pickupEnabled: true, deliveryEnabled: true, deliveryFee: 4.5, freeDeliveryOver: null }).expect(200);
      const a = await createProduct(shop, { basePrice: 10 });
      const b = await createProduct(shop, { basePrice: 15 });
      const checkout = await api().post("/api/orders/checkout").set("Cookie", authCookie(await createUser()))
        .send({ items: [{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 2 }], deliveryMethod: "delivery", shippingAddress: "1 rue X" });
      assert.equal(checkout.status, 201, JSON.stringify(checkout.body));
      const intent = fakeStripe.authorize(fakeStripe.latestIntent()!.id);
      await sendWebhook("payment_intent.amount_capturable_updated", intent);

      const lines = await AppDataSource.getRepository(Order).find();
      const feeLine = lines.find((o) => Number(o.deliveryFee) > 0)!;
      const other = lines.find((o) => o.id !== feeLine.id)!;
      const artisan = authCookie(owner);
      await api().patch(`/api/orders/${feeLine.id}/status`).set("Cookie", artisan).send({ status: "cancelled" }).expect(200);
      await api().patch(`/api/orders/${other.id}/status`).set("Cookie", artisan).send({ status: "fulfilled" }).expect(200);

      const otherCents = Math.round(Number(other.totalAmount) * 100);
      assert.equal(intent.amount_received, otherCents + 450, "the fee was captured with the shipped line");
      const shipped = await AppDataSource.getRepository(Order).findOneByOrFail({ id: other.id });
      assert.equal(Number(shipped.deliveryFee), 4.5, "and now sits on that line");
      assert.equal(shipped.paymentStatus, "paid");
    });

    it("answers both of two simultaneous newsletter sign-ups", async () => {
      const [x, y] = await Promise.all([
        api().post("/api/newsletter/subscribe").send({ email: "same@example.test" }),
        api().post("/api/newsletter/subscribe").send({ email: "same@example.test" }),
      ]);
      assert.deepEqual([x.status, y.status], [200, 200]);
    });

    it("prunes old notifications in the periodic sweep", async () => {
      const user = await createUser();
      const repo = AppDataSource.getRepository(Notification);
      const old = new Date(Date.now() - 100 * 864e5);
      await repo.save([
        { user, title: "old & read", readAt: old, createdAt: old },
        { user, title: "old & unread", createdAt: old },
        { user, title: "fresh & read", readAt: new Date() },
      ]);
      await AppDataSource.query(`UPDATE notifications SET "createdAt" = $1 WHERE title LIKE 'old%'`, [old]);

      await sweepUnpaidCheckouts();
      const left = (await repo.find()).map((n) => n.title).sort();
      assert.deepEqual(left, ["fresh & read", "old & unread"]);
    });

    it("masks email addresses in error reports", () => {
      const event = {
        message: "[notify] couldn't send \"New order\" to ada.lovelace@example.co.uk:",
        extra: { arguments: ["to", "bob+shop@mail.example.test", { nested: ["x@y.io"] }] },
      };
      const scrubbed = scrubEmails(event);
      assert.equal(scrubbed.message, "[notify] couldn't send \"New order\" to [email]:");
      assert.deepEqual(scrubbed.extra.arguments, ["to", "[email]", { nested: ["[email]"] }]);
    });
  });
}

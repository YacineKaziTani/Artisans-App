import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "../src/modules/users/entities/user.entities";
import {
  api,
  authCookie,
  createProduct,
  createShop,
  createUser,
  fakeStripe,
  resetDatabase,
  sendWebhook,
  sentEmails,
} from "./helpers";

async function until(check: () => Promise<boolean>) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

export function notificationTests() {
  describe("in-app notifications and email preferences", () => {
    beforeEach(resetDatabase);

    it("puts a new order in the artisan's bell and inbox, and marks them read", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop);
      const client = authCookie(await createUser(UserRole.CLIENT));
      await api().post("/api/orders").set("Cookie", client).send({ productId: product.id, quantity: 1 });
      await sendWebhook("payment_intent.amount_capturable_updated", fakeStripe.authorize(fakeStripe.latestIntent()!.id));

      const cookie = authCookie(owner);
      assert.ok(await until(async () => (await api().get("/api/notifications").set("Cookie", cookie)).body.unread === 1));
      const list = await api().get("/api/notifications").set("Cookie", cookie);
      assert.match(list.body.data[0].title, /New order/);
      assert.equal(list.body.data[0].link, "/profile-artisan?tab=orders");
      assert.ok(sentEmails.some((e) => e.to === owner.email && /New order/.test(e.subject)));

      // Someone else can't mark it read.
      const stranger = await api().patch(`/api/notifications/${list.body.data[0].id}/read`)
        .set("Cookie", authCookie(await createUser()));
      assert.equal(stranger.body.updated, 0);

      await api().post("/api/notifications/read-all").set("Cookie", cookie).expect(200);
      assert.equal((await api().get("/api/notifications").set("Cookie", cookie)).body.unread, 0);
    });

    it("stops activity emails when turned off, but keeps the in-app notification", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop);
      const off = await api().patch("/api/users/mine").set("Cookie", authCookie(owner)).send({ emailNotifications: false });
      assert.equal(off.status, 200, JSON.stringify(off.body));
      assert.equal(off.body.emailNotifications, false);
      assert.equal(off.body.emailVerified, true, "the profile response keeps the confirmed state");

      const client = authCookie(await createUser(UserRole.CLIENT));
      await api().post("/api/orders").set("Cookie", client).send({ productId: product.id, quantity: 1 });
      await sendWebhook("payment_intent.amount_capturable_updated", fakeStripe.authorize(fakeStripe.latestIntent()!.id));

      assert.ok(await until(async () => (await api().get("/api/notifications").set("Cookie", authCookie(owner))).body.unread === 1));
      assert.ok(!sentEmails.some((e) => e.to === owner.email), "no email to the artisan");
    });
  });
}

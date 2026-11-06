import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { UserRole } from "../src/modules/users/entities/user.entities";
import { Product } from "../src/modules/products/product.entities";
import { Order } from "../src/modules/orders/order.entities";
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

const stockOf = async (productId: string) =>
  (await AppDataSource.getRepository(Product).findOneByOrFail({ id: productId })).stockQuantity;
const orderById = (id: string) => AppDataSource.getRepository(Order).findOneByOrFail({ id });

async function setup(stock: number | null = 3) {
  const { shop, owner } = await createShop();
  const product = await createProduct(shop, { basePrice: 19.99, stockQuantity: stock });
  const client = await createUser(UserRole.CLIENT);
  return { shop, owner, product, client, cookie: authCookie(client) };
}

export function orderTests() {
  describe("orders and payments", () => {
    beforeEach(resetDatabase);

    it("reserves stock and opens a manual-capture hold for the exact amount", async () => {
      const { product, cookie } = await setup(3);

      const res = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 2 });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.ok(res.body.clientSecret);
      assert.equal(Number(res.body.order.totalAmount), 39.98);

      const intent = fakeStripe.latestIntent()!;
      assert.equal(intent.amount, 3998, "amount in integer cents");
      assert.equal(await stockOf(product.id), 1);
    });

    it("refuses to oversell, and leaves the stock alone when it does", async () => {
      const { product, cookie } = await setup(2);

      const res = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 3 });
      assert.equal(res.status, 409);
      assert.match(res.body.message, /Only 2 left/);
      assert.equal(await stockOf(product.id), 2);
      assert.equal(fakeStripe.intents.size, 0, "no payment was opened");
    });

    it("won't let an artisan buy from their own shop", async () => {
      const { product, owner } = await setup(3);
      const cookie = authCookie(owner);

      const single = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1 });
      assert.equal(single.status, 400);
      assert.match(single.body.message, /your own shop/);

      const cart = await api()
        .post("/api/orders/checkout")
        .set("Cookie", cookie)
        .send({ items: [{ productId: product.id, quantity: 1 }] });
      assert.equal(cart.status, 400);

      assert.equal(await stockOf(product.id), 3, "nothing was reserved");
      assert.equal(fakeStripe.intents.size, 0, "no payment was opened");
    });

    it("tells the products list who owns each product, and nothing more", async () => {
      const { owner } = await setup(3);
      const res = await api().get("/api/products");
      assert.equal(res.status, 200);
      const listed = res.body.data[0].shop.owner;
      assert.equal(listed.id, owner.id);
      assert.equal(listed.email, undefined);
      assert.equal(listed.phone, undefined);
    });

    it("sells the last item exactly once when two buyers race for it", async () => {
      const { product } = await setup(1);
      const buyers = await Promise.all([createUser(), createUser(), createUser()]);

      const results = await Promise.all(
        buyers.map((buyer) =>
          api()
            .post("/api/orders")
            .set("Cookie", authCookie(buyer))
            .send({ productId: product.id, quantity: 1 }),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      assert.deepEqual(statuses, [201, 409, 409]);
      assert.equal(await stockOf(product.id), 0);
    });

    it("hands the stock back when the client abandons the checkout", async () => {
      const { product, cookie } = await setup(3);
      const created = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 2 });
      assert.equal(await stockOf(product.id), 1);

      const res = await api()
        .post("/api/orders/abandon")
        .set("Cookie", cookie)
        .send({ orderIds: [created.body.order.id] });
      assert.equal(res.status, 200);
      assert.equal(res.body.discarded, 1);
      assert.equal(await stockOf(product.id), 3);
      assert.equal(fakeStripe.latestIntent()!.status, "canceled");
    });

    it("won't let someone else abandon (and so delete) your order", async () => {
      const { product, cookie } = await setup(3);
      const created = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1 });

      const stranger = await createUser();
      const res = await api()
        .post("/api/orders/abandon")
        .set("Cookie", authCookie(stranger))
        .send({ orderIds: [created.body.order.id] });
      assert.equal(res.body.discarded, 0);
      assert.ok(await orderById(created.body.order.id));
    });

    it("moves an order through authorized → fulfilled → paid", async () => {
      const { product, owner, cookie } = await setup(null); // made to order
      const created = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1 });
      const orderId = created.body.order.id;

      // Fulfilling before the card is authorized isn't allowed.
      const early = await api()
        .patch(`/api/orders/${orderId}/status`)
        .set("Cookie", authCookie(owner))
        .send({ status: "fulfilled" });
      assert.equal(early.status, 400);

      const intent = fakeStripe.authorize(fakeStripe.latestIntent()!.id);
      const hook = await sendWebhook("payment_intent.amount_capturable_updated", intent);
      assert.equal(hook.status, 200);
      assert.equal((await orderById(orderId)).paymentStatus, "authorized");

      const fulfil = await api()
        .patch(`/api/orders/${orderId}/status`)
        .set("Cookie", authCookie(owner))
        .send({ status: "fulfilled" });
      assert.equal(fulfil.status, 200, JSON.stringify(fulfil.body));
      assert.equal(intent.status, "succeeded", "the hold was captured");
      const order = await orderById(orderId);
      assert.equal(order.status, "fulfilled");
      assert.equal(order.paymentStatus, "paid");
    });

    it("only the shop's owner can fulfil its orders", async () => {
      const { product, cookie } = await setup(null);
      const created = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1 });
      await sendWebhook(
        "payment_intent.amount_capturable_updated",
        fakeStripe.authorize(fakeStripe.latestIntent()!.id),
      );

      const { owner: otherArtisan } = await createShop();
      const res = await api()
        .patch(`/api/orders/${created.body.order.id}/status`)
        .set("Cookie", authCookie(otherArtisan))
        .send({ status: "fulfilled" });
      assert.ok([403, 404].includes(res.status), `got ${res.status}`);
      assert.equal((await orderById(created.body.order.id)).status, "pending");
    });

    it("releases the hold and restocks when the client cancels an authorized order", async () => {
      const { product, cookie } = await setup(5);
      const created = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 2 });
      const intent = fakeStripe.authorize(fakeStripe.latestIntent()!.id);
      await sendWebhook("payment_intent.amount_capturable_updated", intent);
      assert.equal(await stockOf(product.id), 3);

      const res = await api()
        .patch(`/api/orders/${created.body.order.id}/cancel`)
        .set("Cookie", cookie);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(intent.status, "canceled");
      assert.equal(await stockOf(product.id), 5);
      assert.equal(fakeStripe.refunds.length, 0, "nothing was charged, so nothing to refund");
    });

    it("ignores replayed and unsigned webhook events", async () => {
      const { product, cookie } = await setup(null);
      const created = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1 });
      const intent = fakeStripe.authorize(fakeStripe.latestIntent()!.id);

      const unsigned = await sendWebhook("payment_intent.amount_capturable_updated", intent, {
        signature: "forged",
      });
      assert.equal(unsigned.status, 400);
      assert.equal((await orderById(created.body.order.id)).paymentStatus, "unpaid");

      const first = await sendWebhook("payment_intent.amount_capturable_updated", intent, {
        eventId: "evt_same",
      });
      assert.equal(first.status, 200);
      const replay = await sendWebhook("payment_intent.amount_capturable_updated", intent, {
        eventId: "evt_same",
      });
      assert.equal(replay.body.duplicate, true);
    });

    it("never moves a paid order backwards on a late event", async () => {
      const { product, owner, cookie } = await setup(null);
      const created = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1 });
      const intent = fakeStripe.authorize(fakeStripe.latestIntent()!.id);
      await sendWebhook("payment_intent.amount_capturable_updated", intent);
      await api()
        .patch(`/api/orders/${created.body.order.id}/status`)
        .set("Cookie", authCookie(owner))
        .send({ status: "fulfilled" })
        .expect(200);

      // A delayed "payment failed" from earlier arrives after the capture.
      await sendWebhook("payment_intent.payment_failed", intent);
      assert.equal((await orderById(created.body.order.id)).paymentStatus, "paid");
    });
  });
}

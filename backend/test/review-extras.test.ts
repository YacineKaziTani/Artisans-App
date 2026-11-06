import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { User } from "../src/modules/users/entities/user.entities";
import { Shop } from "../src/modules/shop/shop.entities";
import { Product } from "../src/modules/products/product.entities";
import { Review } from "../src/modules/reviews/review.entities";
import { Order, OrderPaymentStatus, OrderStatus } from "../src/modules/orders/order.entities";
import {
  api,
  authCookie,
  createProduct,
  createShop,
  createUser,
  destroyedUploads,
  resetDatabase,
  sentEmails,
} from "./helpers";

async function fulfilledOrder(client: User, shop: Shop, product: Product) {
  await AppDataSource.getRepository(Order).save(
    AppDataSource.getRepository(Order).create({
      client, shop, product, productId: product.id, quantity: 1, totalAmount: 25,
      status: OrderStatus.FULFILLED, paymentStatus: OrderPaymentStatus.PAID,
    }),
  );
}

async function waitForEmail(subject: RegExp) {
  for (let i = 0; i < 100; i++) {
    if (sentEmails.some((e) => subject.test(e.subject))) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

export function reviewExtrasTests() {
  describe("review photos, product tags and replies", () => {
    beforeEach(resetDatabase);

    it("lets a client tag only a product they received, shown on that product's page", async () => {
      const { shop } = await createShop();
      const bought = await createProduct(shop, { title: "Bowl" });
      const notBought = await createProduct(shop, { title: "Vase" });
      const client = await createUser();
      await fulfilledOrder(client, shop, bought);
      const cookie = authCookie(client);

      const eligibility = await api().get(`/api/reviews/shop/${shop.id}/eligibility`).set("Cookie", cookie);
      assert.deepEqual(eligibility.body.products, [{ id: bought.id, title: "Bowl" }]);

      const wrong = await api().post(`/api/reviews/shop/${shop.id}`).set("Cookie", cookie)
        .send({ rating: 5, productId: notBought.id });
      assert.equal(wrong.status, 400);
      assert.equal(wrong.body.field, "productId");

      const ok = await api().post(`/api/reviews/shop/${shop.id}`).set("Cookie", cookie)
        .send({ rating: 5, comment: "Lovely bowl", productId: bought.id });
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      assert.equal(ok.body.product.title, "Bowl");

      const onProduct = await api().get(`/api/reviews/product/${bought.id}`);
      assert.equal(onProduct.body.length, 1);
      assert.equal((await api().get(`/api/reviews/product/${notBought.id}`)).body.length, 0);
    });

    it("lets only the shop's owner reply, and tells the reviewer", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop);
      const client = await createUser();
      await fulfilledOrder(client, shop, product);
      const review = await api().post(`/api/reviews/shop/${shop.id}`).set("Cookie", authCookie(client))
        .send({ rating: 4 });

      const stranger = await api().put(`/api/reviews/${review.body.id}/reply`)
        .set("Cookie", authCookie(await createUser())).send({ reply: "Hi" });
      assert.equal(stranger.status, 403);

      const reply = await api().put(`/api/reviews/${review.body.id}/reply`)
        .set("Cookie", authCookie(owner)).send({ reply: "Thank you so much!" });
      assert.equal(reply.status, 200, JSON.stringify(reply.body));
      assert.equal(reply.body.reply, "Thank you so much!");

      const listed = await api().get(`/api/reviews/shop/${shop.id}`);
      assert.equal(listed.body[0].reply, "Thank you so much!");
      assert.ok(await waitForEmail(/replied to your review/), "the reviewer was emailed");
    });

    it("lets the author remove a photo, deleting it from storage", async () => {
      const { shop } = await createShop();
      const author = await createUser();
      const review = await AppDataSource.getRepository(Review).save({
        rating: 5, shop, author,
        photos: [
          { url: "https://res.cloudinary.com/x/image/upload/a.jpg", publicId: "a" },
          { url: "https://res.cloudinary.com/x/image/upload/b.jpg", publicId: "b" },
        ],
      });

      const stranger = await api().delete(`/api/reviews/${review.id}/photos/0`).set("Cookie", authCookie(await createUser()));
      assert.equal(stranger.status, 403);

      const res = await api().delete(`/api/reviews/${review.id}/photos/0`).set("Cookie", authCookie(author));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.photos.map((p: { publicId: string }) => p.publicId), ["b"]);
      assert.ok(destroyedUploads.includes("a"));

      await api().delete(`/api/reviews/${review.id}`).set("Cookie", authCookie(author)).expect(200);
      assert.ok(destroyedUploads.includes("b"), "deleting the review deletes its photos");
    });
  });
}

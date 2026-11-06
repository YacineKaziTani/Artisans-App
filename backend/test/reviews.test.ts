import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { User, UserRole } from "../src/modules/users/entities/user.entities";
import { Shop } from "../src/modules/shop/shop.entities";
import { Product } from "../src/modules/products/product.entities";
import {
  Order,
  OrderPaymentStatus,
  OrderStatus,
} from "../src/modules/orders/order.entities";
import { api, authCookie, createProduct, createShop, createUser, resetDatabase } from "./helpers";

/** A fulfilled, paid order — what makes a client eligible to review. */
async function purchased(client: User, shop: Shop, product: Product) {
  await AppDataSource.getRepository(Order).save(
    AppDataSource.getRepository(Order).create({
      client,
      shop,
      product,
      productId: product.id,
      quantity: 1,
      totalAmount: 25,
      status: OrderStatus.FULFILLED,
      paymentStatus: OrderPaymentStatus.PAID,
    }),
  );
}

export function reviewTests() {
  describe("reviews", () => {
    beforeEach(resetDatabase);

    it("only lets clients who bought something review, once each", async () => {
      const { shop } = await createShop();
      const product = await createProduct(shop);
      const client = await createUser(UserRole.CLIENT);
      const cookie = authCookie(client);

      const before = await api()
        .post(`/api/reviews/shop/${shop.id}`)
        .set("Cookie", cookie)
        .send({ rating: 5, comment: "Lovely" });
      assert.equal(before.status, 403);

      await purchased(client, shop, product);
      const eligibility = await api()
        .get(`/api/reviews/shop/${shop.id}/eligibility`)
        .set("Cookie", cookie);
      assert.equal(eligibility.status, 200);

      const created = await api()
        .post(`/api/reviews/shop/${shop.id}`)
        .set("Cookie", cookie)
        .send({ rating: 4, comment: "Lovely" });
      assert.equal(created.status, 201, JSON.stringify(created.body));

      const again = await api()
        .post(`/api/reviews/shop/${shop.id}`)
        .set("Cookie", cookie)
        .send({ rating: 1 });
      assert.equal(again.status, 409);
    });

    it("keeps the shop's average rating in step", async () => {
      const { shop } = await createShop();
      const product = await createProduct(shop);
      const [a, b] = await Promise.all([createUser(), createUser()]);
      await purchased(a, shop, product);
      await purchased(b, shop, product);

      await api().post(`/api/reviews/shop/${shop.id}`).set("Cookie", authCookie(a)).send({ rating: 5 }).expect(201);
      await api().post(`/api/reviews/shop/${shop.id}`).set("Cookie", authCookie(b)).send({ rating: 2 }).expect(201);

      const reloaded = await AppDataSource.getRepository(Shop).findOneByOrFail({ id: shop.id });
      assert.equal(reloaded.averageRating, 3.5);
    });

    it("doesn't let an artisan review their own shop", async () => {
      const { shop, owner } = await createShop();
      const res = await api()
        .post(`/api/reviews/shop/${shop.id}`)
        .set("Cookie", authCookie(owner))
        .send({ rating: 5 });
      assert.equal(res.status, 403);
    });

    it("rejects ratings outside 1–5", async () => {
      const { shop } = await createShop();
      const res = await api()
        .post(`/api/reviews/shop/${shop.id}`)
        .set("Cookie", authCookie(await createUser()))
        .send({ rating: 6 });
      assert.equal(res.status, 400);
      assert.equal(res.body.field, "rating");
    });
  });
}

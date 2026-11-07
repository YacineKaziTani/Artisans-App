import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { User, UserRole } from "../src/modules/users/entities/user.entities";
import { Shop } from "../src/modules/shop/shop.entities";
import { Review } from "../src/modules/reviews/review.entities";
import { Order, OrderPaymentStatus, OrderStatus } from "../src/modules/orders/order.entities";
import {
  api,
  authCookie,
  createProduct,
  createShop,
  createUser,
  resetDatabase,
  TEST_PASSWORD,
} from "./helpers";

export function accountTests() {
  describe("delete my account / download my data", () => {
    beforeEach(resetDatabase);

    it("exports the account's data as a JSON download, without secrets", async () => {
      const { shop } = await createShop();
      const product = await createProduct(shop, { title: "Bowl" });
      const client = await createUser();
      await AppDataSource.getRepository(Order).save(
        AppDataSource.getRepository(Order).create({
          client, shop, product, productId: product.id, quantity: 2, totalAmount: 50,
          status: OrderStatus.FULFILLED, paymentStatus: OrderPaymentStatus.PAID,
        }),
      );
      await AppDataSource.getRepository(Review).save({ rating: 5, comment: "Lovely", shop, author: client });

      const res = await api().get("/api/users/mine/export").set("Cookie", authCookie(client));
      assert.equal(res.status, 200);
      assert.match(res.headers["content-disposition"], /attachment; filename="artisan-market-data-/);
      const data = JSON.parse(res.text);
      assert.equal(data.account.email, client.email);
      assert.equal(data.orders[0].product, "Bowl");
      assert.equal(data.reviews[0].comment, "Lovely");
      assert.ok(!res.text.includes("password"), "no password hash");
      assert.ok(!res.text.includes("acct_secret_should_never_leak"));
    });

    it("needs the password, and erases personal data while keeping history consistent", async () => {
      const { shop } = await createShop();
      const client = await createUser();
      await AppDataSource.getRepository(Review).save({ rating: 4, shop, author: client });
      const cookie = authCookie(client);

      const wrong = await api().delete("/api/users/mine").set("Cookie", cookie).send({ password: "nope" });
      assert.equal(wrong.status, 400);

      const res = await api().delete("/api/users/mine").set("Cookie", cookie).send({ password: TEST_PASSWORD });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const gone = await AppDataSource.getRepository(User).findOneByOrFail({ id: client.id });
      assert.equal(gone.name, "Deleted user");
      assert.match(gone.email, /@deleted\.invalid$/);
      assert.ok(gone.deletedAt);
      assert.equal((await api().get("/api/auth/me").set("Cookie", cookie)).status, 403, "the session no longer works");
      assert.equal(await AppDataSource.getRepository(Review).count(), 1, "their review stays (anonymous)");
      const login = await api().post("/api/auth/login").send({ email: client.email, password: TEST_PASSWORD });
      assert.equal(login.status, 401, "the old email can't sign in");
    });

    it("refuses while orders are in progress, and closes an artisan's shop", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop);
      const client = await createUser();
      const order = await AppDataSource.getRepository(Order).save(
        AppDataSource.getRepository(Order).create({
          client, shop, product, productId: product.id, quantity: 1, totalAmount: 25,
          status: OrderStatus.PENDING, paymentStatus: OrderPaymentStatus.AUTHORIZED,
        }),
      );

      const clientTry = await api().delete("/api/users/mine").set("Cookie", authCookie(client)).send({ password: TEST_PASSWORD });
      assert.equal(clientTry.status, 409);
      const artisanTry = await api().delete("/api/users/mine").set("Cookie", authCookie(owner)).send({ password: TEST_PASSWORD });
      assert.equal(artisanTry.status, 409);
      assert.match(artisanTry.body.message, /shop has orders/);

      await AppDataSource.getRepository(Order).update(order.id, { status: OrderStatus.FULFILLED, paymentStatus: OrderPaymentStatus.PAID });
      await api().delete("/api/users/mine").set("Cookie", authCookie(owner)).send({ password: TEST_PASSWORD }).expect(200);
      const closed = await AppDataSource.getRepository(Shop).findOneByOrFail({ id: shop.id });
      assert.equal(closed.status, "closed");
    });

    it("won't let the only admin delete themselves", async () => {
      const admin = await createUser(UserRole.SUPER_ADMIN);
      const res = await api().delete("/api/users/mine").set("Cookie", authCookie(admin)).send({ password: TEST_PASSWORD });
      assert.equal(res.status, 409);
    });
  });
}

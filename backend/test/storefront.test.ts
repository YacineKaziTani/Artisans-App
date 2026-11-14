import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { Shop } from "../src/modules/shop/shop.entities";
import { Review } from "../src/modules/reviews/review.entities";
import { Favorite, FavoriteTargetType } from "../src/modules/favorites/favorite.entities";
import { Order, OrderPaymentStatus, OrderStatus } from "../src/modules/orders/order.entities";
import { ShopStatus } from "../src/modules/shop/shop.entities";
import {
  TEST_PNG,
  api,
  authCookie,
  createProduct,
  createShop,
  createUser,
  destroyedUploads,
  resetDatabase,
} from "./helpers";

async function placeOrder(product: { id: string }, shop: Shop, paymentStatus: OrderPaymentStatus, status = OrderStatus.PENDING) {
  return AppDataSource.getRepository(Order).save(
    AppDataSource.getRepository(Order).create({
      client: await createUser(),
      shop,
      product: product as never,
      productId: product.id,
      quantity: 1,
      totalAmount: 25,
      status,
      paymentStatus,
    }),
  );
}

export function storefrontTests() {
  describe("storefront: shop page, home page and product page data", () => {
    beforeEach(resetDatabase);

    it("lets the artisan set a cover photo and story, and never leaks the cover's storage id", async () => {
      const { shop, owner } = await createShop();
      const cookie = authCookie(owner);

      const up = await api().put("/api/shops/mine/cover").set("Cookie", cookie).attach("image", TEST_PNG, "cover.png");
      assert.equal(up.status, 200, JSON.stringify(up.body));
      assert.match(up.body.shop.coverUrl, /^https:\/\/res\.cloudinary\.com\//);
      assert.equal(up.body.shop.coverPublicId, undefined);

      // Replacing it deletes the old file.
      const again = await api().put("/api/shops/mine/cover").set("Cookie", cookie).attach("image", TEST_PNG, "cover2.png");
      assert.equal(again.status, 200);
      const firstId = (await AppDataSource.getRepository(Shop).findOneByOrFail({ id: shop.id })).coverPublicId;
      assert.ok(firstId);
      assert.ok(destroyedUploads.length > 0);

      await api().put("/api/shops/mine").set("Cookie", cookie).send({ story: "Three generations of potters." }).expect(200);

      const page = await api().get(`/api/shops/${shop.id}`);
      assert.equal(page.status, 200);
      assert.equal(page.body.story, "Three generations of potters.");
      assert.ok(page.body.coverUrl);
      assert.equal(page.body.coverPublicId, undefined);
      assert.equal(page.body.stripeAccountId, undefined);

      const removed = await api().delete("/api/shops/mine/cover").set("Cookie", cookie);
      assert.equal(removed.status, 200);
      assert.equal(removed.body.shop.coverUrl, null);
      assert.ok(destroyedUploads.includes(firstId!));
    });

    it("only artisans can set a cover", async () => {
      const res = await api()
        .put("/api/shops/mine/cover")
        .set("Cookie", authCookie(await createUser()))
        .attach("image", TEST_PNG, "cover.png");
      assert.equal(res.status, 403);
    });

    it("shows reviews, followers and completed sales on the shop page", async () => {
      const { shop } = await createShop();
      const product = await createProduct(shop);
      await placeOrder(product, shop, OrderPaymentStatus.PAID, OrderStatus.FULFILLED);
      await placeOrder(product, shop, OrderPaymentStatus.AUTHORIZED); // not a sale yet
      const fan = await createUser();
      await AppDataSource.getRepository(Favorite).save({ user: fan, targetType: FavoriteTargetType.SHOP, targetId: shop.id });
      await AppDataSource.getRepository(Review).save({ shop, author: fan, rating: 5, comment: "Lovely" });

      const res = await api().get(`/api/shops/${shop.id}`).expect(200);
      assert.deepEqual(res.body.stats, { reviewCount: 1, followerCount: 1, salesCount: 1 });
    });

    it("ranks trending products by recent orders, and skips hidden ones", async () => {
      const { shop } = await createShop();
      const quiet = await createProduct(shop, { title: "Quiet" });
      const hot = await createProduct(shop, { title: "Hot" });
      const archived = await createProduct(shop, { title: "Gone", archivedAt: new Date() });
      await placeOrder(hot, shop, OrderPaymentStatus.AUTHORIZED);
      await placeOrder(hot, shop, OrderPaymentStatus.PAID, OrderStatus.FULFILLED);
      await placeOrder(quiet, shop, OrderPaymentStatus.UNPAID); // abandoned checkout: doesn't count
      const { shop: closed } = await createShop(undefined, { status: ShopStatus.CLOSED });
      await createProduct(closed, { title: "Closed shop" });

      const res = await api().get("/api/products/trending?limit=5").expect(200);
      const titles = res.body.map((p: { title: string }) => p.title);
      assert.equal(titles[0], "Hot");
      assert.ok(titles.includes("Quiet"));
      assert.ok(!titles.includes("Gone") && !titles.includes("Closed shop"));
      assert.equal(res.body[0].shop.shopName, shop.shopName);
      assert.ok(!res.body.some((p: { id: string }) => p.id === archived.id));
    });

    it("suggests similar products from the same craft, not the product itself", async () => {
      const { shop, category } = await createShop();
      const product = await createProduct(shop);
      const { shop: neighbour } = await createShop(undefined, { category });
      const alike = await createProduct(neighbour, { title: "Alike" });
      const { shop: other } = await createShop(); // a different category
      await createProduct(other, { title: "Unrelated" });

      const res = await api().get(`/api/products/${product.id}/similar`).expect(200);
      assert.deepEqual(res.body.map((p: { id: string }) => p.id), [alike.id]);
    });

    it("picks well-rated reviews with something to say for the home page, first names only", async () => {
      const { shop } = await createShop();
      const author = await createUser(undefined, { name: "Amina Benali" });
      await AppDataSource.getRepository(Review).save({
        shop,
        author,
        rating: 5,
        comment: "Beautiful bowl, carefully packed and arrived quickly.",
      });
      await AppDataSource.getRepository(Review).save({ shop, author: await createUser(), rating: 5, comment: "Nice" });
      await AppDataSource.getRepository(Review).save({
        shop,
        author: await createUser(),
        rating: 2,
        comment: "Took a long time and the colour was not as pictured.",
      });

      const res = await api().get("/api/reviews/highlights").expect(200);
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].author.name, "Amina");
      assert.equal(res.body[0].author.email, undefined);
      assert.equal(res.body[0].shop.id, shop.id);
    });
  });
}

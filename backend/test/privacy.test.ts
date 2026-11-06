import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "../src/modules/users/entities/user.entities";
import { ShopStatus } from "../src/modules/shop/shop.entities";
import { api, authCookie, createProduct, createShop, createUser, resetDatabase } from "./helpers";

/** Fails if any of `secrets` appears anywhere in the JSON body. */
function assertNoLeak(body: unknown, secrets: string[]) {
  const text = JSON.stringify(body);
  for (const secret of secrets) {
    assert.ok(!text.includes(secret), `response leaked ${JSON.stringify(secret)}`);
  }
}

export function privacyTests() {
  describe("privacy and visibility", () => {
    beforeEach(resetDatabase);

    it("public shop pages don't expose the owner's contact details or Stripe account", async () => {
      const { shop, owner } = await createShop();
      await createProduct(shop);

      const list = await api().get("/api/shops");
      assert.equal(list.status, 200);
      assert.equal(list.body.data.length, 1);
      const detail = await api().get(`/api/shops/${shop.id}`);
      assert.equal(detail.status, 200);
      const product = await api().get(`/api/products/${detail.body.products[0].id}`);
      assert.equal(product.status, 200);

      for (const res of [list, detail, product]) {
        assertNoLeak(res.body, [owner.email, owner.phone, "acct_secret_should_never_leak", "internal admin note"]);
      }
      assert.equal(detail.body.acceptsPayments, true);
    });

    it("hides shops that aren't active from the public", async () => {
      const { shop } = await createShop(undefined, { status: ShopStatus.PENDING });
      await createProduct(shop);

      assert.equal((await api().get(`/api/shops/${shop.id}`)).status, 404);
      assert.equal((await api().get("/api/shops")).body.data.length, 0);
      assert.equal((await api().get("/api/products")).body.data.length, 0);
    });

    it("lets an admin preview a pending shop, with the owner's contact details", async () => {
      const admin = await createUser(UserRole.SUPER_ADMIN);
      const { shop, owner } = await createShop(undefined, { status: ShopStatus.PENDING });

      const res = await api().get(`/api/shops/admin/${shop.id}`).set("Cookie", authCookie(admin));
      assert.equal(res.status, 200);
      assert.equal(res.body.owner.email, owner.email);
      assertNoLeak(res.body, ["acct_secret_should_never_leak"]);

      const client = await createUser(UserRole.CLIENT);
      const denied = await api().get(`/api/shops/admin/${shop.id}`).set("Cookie", authCookie(client));
      assert.equal(denied.status, 403);
    });

    it("answers 404 (not 500) for ids that aren't UUIDs", async () => {
      assert.equal((await api().get("/api/shops/not-a-uuid")).status, 404);
      assert.equal((await api().get("/api/products/123")).status, 404);
    });

    it("reports database health", async () => {
      const res = await api().get("/healthz");
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: "ok", db: true });
    });
  });
}

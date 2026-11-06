import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { ProductVariant, VariantOption } from "../src/modules/products/variant.entities";
import { ShopStatus } from "../src/modules/shop/shop.entities";
import { api, createProduct, createShop, resetDatabase } from "./helpers";

const titles = (res: { body: { data: { title: string }[] } }) =>
  res.body.data.map((p) => p.title).sort();

export function searchTests() {
  describe("product and shop search", () => {
    beforeEach(resetDatabase);

    it("filters by city, shop rating and stock, and matches shop names", async () => {
      const { shop: lyon } = await createShop(undefined, { city: "Lyon", averageRating: 4.6, shopName: "Atelier Bois" });
      const { shop: paris } = await createShop(undefined, { city: "Paris", averageRating: 3.2 });
      await createProduct(lyon, { title: "Oak stool", stockQuantity: 3 });
      await createProduct(lyon, { title: "Sold-out bowl", stockQuantity: 0 });
      await createProduct(paris, { title: "Made-to-order vase", stockQuantity: null });

      // A product with options: in stock only through a variant.
      const withOptions = await createProduct(paris, { title: "Scarf" });
      await AppDataSource.getRepository(VariantOption).save({ name: "Colour", product: withOptions });
      const variants = AppDataSource.getRepository(ProductVariant);
      const variant = await variants.save({ product: withOptions, stockQuantity: 0 });

      assert.deepEqual(titles(await api().get("/api/products?city=lyo")), ["Oak stool", "Sold-out bowl"]);
      assert.deepEqual(titles(await api().get("/api/products?minRating=4")), ["Oak stool", "Sold-out bowl"]);
      assert.deepEqual(titles(await api().get("/api/products?search=atelier")), ["Oak stool", "Sold-out bowl"], "matches the shop name");
      assert.deepEqual(titles(await api().get("/api/products?inStock=true")), ["Made-to-order vase", "Oak stool"]);

      await variants.update(variant.id, { stockQuantity: 2 });
      assert.deepEqual(
        titles(await api().get("/api/products?inStock=true")),
        ["Made-to-order vase", "Oak stool", "Scarf"],
        "a product with options counts once a variant has stock",
      );

      const byRating = await api().get("/api/products?sort=rating");
      assert.equal(byRating.body.data[0].shop.city, "Lyon");
    });

    it("lists only public pages for the sitemap", async () => {
      const { shop: open } = await createShop();
      const { shop: pending } = await createShop(undefined, { status: ShopStatus.PENDING });
      const live = await createProduct(open);
      await createProduct(open, { archivedAt: new Date() });
      await createProduct(pending);

      const res = await api().get("/api/seo/sitemap");
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.shops.map((s: { id: string }) => s.id), [open.id]);
      assert.deepEqual(res.body.products.map((p: { id: string }) => p.id), [live.id]);
      assert.ok(res.body.shops[0].updatedAt);
    });

    it("filters and sorts shops", async () => {
      await createShop(undefined, { shopName: "Zed Ceramics", averageRating: 4.8 });
      await createShop(undefined, { shopName: "Alpha Weaving", averageRating: 2.1 });

      const top = await api().get("/api/shops?minRating=4");
      assert.deepEqual(top.body.data.map((s: { shopName: string }) => s.shopName), ["Zed Ceramics"]);

      const byName = await api().get("/api/shops?sort=name");
      assert.deepEqual(byName.body.data.map((s: { shopName: string }) => s.shopName), ["Alpha Weaving", "Zed Ceramics"]);
    });
  });
}

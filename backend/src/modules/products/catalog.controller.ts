import { Request, Response } from "express";
import { In, IsNull } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Product } from "./product.entities";
import { MAX_FEATURED } from "./product.controller";
import { VariantOption } from "./variant.entities";
import { Shop, ShopStatus } from "../shop/shop.entities";
import { parseCsv, toCsv } from "../../lib/csv";
import { notifyInBackground } from "../../notifications/deliver";
import { notifyFollowersOfNewProduct } from "../../notifications";

const productRepo = AppDataSource.getRepository(Product);
const shopRepo = AppDataSource.getRepository(Shop);

// Crawlers, link previewers and uptime checkers aren't shoppers.
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|monitor|lighthouse|headless/i;

/**
 * POST /products/:id/view — counts a product page view (one row per
 * product per day; nothing about the visitor is stored). The shop's own
 * owner and obvious bots aren't counted.
 */
export const recordProductView = async (req: Request, res: Response) => {
  try {
    if (BOT_UA.test(String(req.headers["user-agent"] ?? ""))) return res.status(204).send();
    const id = String(req.params.id);
    const rows: { ownerId: string | null }[] = await AppDataSource.query(
      `SELECT s."ownerId" FROM products p JOIN shops s ON s.id = p."shopId"
        WHERE p.id = $1 AND p."archivedAt" IS NULL AND s.status = 'active'`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    if (req.user && rows[0].ownerId === req.user.id) return res.status(204).send();

    await AppDataSource.query(
      `INSERT INTO product_views ("productId", day, views) VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1)
       ON CONFLICT ("productId", day) DO UPDATE SET views = product_views.views + 1`,
      [id],
    );
    return res.status(204).send();
  } catch (error) {
    console.error("recordProductView failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const CSV_HEADER = ["id", "title", "description", "price", "compare_at_price", "stock", "featured"];

/** GET /products/mine/export — the artisan's catalogue as a spreadsheet. */
export const exportMyProducts = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({ where: { owner: { id: req.user!.id } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    const products = await productRepo.find({
      where: { shop: { id: shop.id }, archivedAt: IsNull() },
      order: { createdAt: "ASC" },
    });
    const withOptions = await optionProductIds(products.map((p) => p.id));
    const csv = toCsv(
      CSV_HEADER,
      products.map((p) => [
        p.id,
        p.title,
        p.description ?? "",
        Number(p.basePrice).toFixed(2),
        p.compareAtPrice != null ? Number(p.compareAtPrice).toFixed(2) : "",
        // Products with options keep stock per option — not editable here.
        withOptions.has(p.id) ? "options" : p.stockQuantity ?? "untracked",
        p.featured ? "yes" : "no",
      ]),
    );
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="products.csv"');
    return res.send(csv);
  } catch (error) {
    console.error("exportMyProducts failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

async function optionProductIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const rows = await AppDataSource.getRepository(VariantOption)
    .createQueryBuilder("o")
    .select('DISTINCT o."productId"', "productId")
    .where('o."productId" IN (:...ids)', { ids })
    .getRawMany<{ productId: string }>();
  return new Set(rows.map((r) => r.productId));
}

export const MAX_IMPORT_ROWS = 500;
const MAX_PRICE = 99_999_999.99;

/** Undo the ' an export put in front of formula-like text. */
const unformula = (text: string) => (/^'[=+\-@\t\r]/.test(text) ? text.slice(1) : text);

function parseMoney(raw: string, label: string, errors: string[], row: number): number | null | undefined {
  const text = raw.trim().replace(/^\$/, "");
  if (text === "") return undefined;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) {
    errors.push(`Row ${row}: ${label} "${raw}" isn't a valid amount`);
    return null;
  }
  return Math.round(n * 100) / 100;
}

interface ImportRow {
  row: number;
  id?: string;
  title?: string;
  description?: string;
  price?: number;
  compareAt?: number | null;
  /** undefined = leave; null = not tracked. */
  stock?: number | null;
  featured?: boolean;
}

/**
 * POST /products/mine/import (text/csv) — creates and updates products
 * from a spreadsheet with the export's columns. Rows with an id update
 * that product (empty cells leave a field as it is); rows without one
 * create a product. Everything is checked first: if any row has a
 * problem, nothing is changed and every problem is listed.
 */
export const importMyProducts = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({ where: { owner: { id: req.user!.id } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (typeof req.body !== "string" || !req.body.trim()) {
      return res.status(400).json({ message: "Upload a CSV file with a header row" });
    }

    const table = parseCsv(req.body);
    const header = (table.shift() ?? []).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const col = (name: string) => header.indexOf(name);
    if (col("title") < 0 && col("id") < 0) {
      return res.status(400).json({ message: 'The first row must name the columns — at least "title" and "price".' });
    }
    if (table.length === 0) return res.status(400).json({ message: "The file has no products in it" });
    if (table.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ message: `Import at most ${MAX_IMPORT_ROWS} products at a time` });
    }

    const errors: string[] = [];
    const rows: ImportRow[] = table.map((cells, index) => {
      const row = index + 2; // spreadsheet row number (header is row 1)
      const cell = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "") : "");
      const out: ImportRow = { row };
      const id = cell("id").trim();
      if (id) out.id = id;
      const title = unformula(cell("title").trim());
      if (title) out.title = title.slice(0, 150);
      else if (!id) errors.push(`Row ${row}: a new product needs a title`);
      if (title.length > 150) errors.push(`Row ${row}: the title is longer than 150 characters`);
      const description = unformula(cell("description").trim());
      if (description) out.description = description.slice(0, 5000);
      const price = parseMoney(cell("price"), "price", errors, row);
      if (price != null) {
        if (price < 0.5) errors.push(`Row ${row}: the price must be at least $0.50`);
        out.price = price;
      } else if (price === undefined && !id) {
        errors.push(`Row ${row}: a new product needs a price`);
      }
      const compare = cell("compare_at_price").trim();
      if (compare === "-" || compare.toLowerCase() === "none") out.compareAt = null;
      else {
        const c = parseMoney(compare, "compare-at price", errors, row);
        if (c != null) out.compareAt = c;
      }
      const stock = cell("stock").trim().toLowerCase();
      if (stock === "untracked" || stock === "made to order") out.stock = null;
      else if (stock !== "" && stock !== "options") {
        const n = Number(stock);
        if (!Number.isInteger(n) || n < 0 || n > 1_000_000) errors.push(`Row ${row}: stock "${stock}" must be a whole number`);
        else out.stock = n;
      }
      const featured = cell("featured").trim().toLowerCase();
      if (["yes", "true", "1", "y"].includes(featured)) out.featured = true;
      else if (["no", "false", "0", "n"].includes(featured)) out.featured = false;
      return out;
    });

    // Updates must name this shop's own, live products.
    const ids = rows.flatMap((r) => (r.id ? [r.id] : []));
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const r of rows) {
      if (r.id && !uuidLike.test(r.id)) errors.push(`Row ${r.row}: "${r.id}" isn't a product id from your export`);
    }
    const existing = ids.filter((id) => uuidLike.test(id)).length
      ? await productRepo.find({
          where: { id: In(ids.filter((id) => uuidLike.test(id))), shop: { id: shop.id }, archivedAt: IsNull() },
        })
      : [];
    const byId = new Map(existing.map((p) => [p.id, p]));
    const withOptions = await optionProductIds(existing.map((p) => p.id));
    for (const r of rows) {
      if (r.id && uuidLike.test(r.id) && !byId.has(r.id)) {
        errors.push(`Row ${r.row}: no product with id ${r.id} in your shop`);
      }
      if (r.id && withOptions.has(r.id) && r.stock !== undefined) {
        errors.push(`Row ${r.row}: this product has options — set its stock per option in your shop instead`);
      }
      const current = r.id ? byId.get(r.id) : undefined;
      const price = r.price ?? (current ? Number(current.basePrice) : undefined);
      const compareAt = r.compareAt !== undefined ? r.compareAt : current?.compareAtPrice ?? null;
      if (price !== undefined && compareAt != null && Number(compareAt) <= price) {
        errors.push(`Row ${r.row}: the compare-at price must be higher than the price (it's shown crossed out)`);
      }
    }
    const wasFeatured = new Set(existing.filter((p) => p.featured).map((p) => p.id));
    const otherFeatured = await productRepo.count({ where: { shop: { id: shop.id }, featured: true, archivedAt: IsNull() } });
    let featuredCount = otherFeatured;
    for (const r of rows) {
      if (r.featured === undefined) continue;
      const was = r.id ? wasFeatured.has(r.id) : false;
      if (r.featured && !was) featuredCount++;
      if (!r.featured && was) featuredCount--;
    }
    if (featuredCount > MAX_FEATURED) errors.push(`At most ${MAX_FEATURED} products can be featured`);

    if (errors.length) {
      return res.status(400).json({ message: `Nothing was imported — fix ${errors.length === 1 ? "this problem" : "these problems"} and try again.`, errors: errors.slice(0, 50) });
    }

    let created = 0;
    let updated = 0;
    const createdIds: string[] = [];
    await AppDataSource.transaction(async (manager) => {
      for (const r of rows) {
        if (r.id) {
          const changes: Partial<Product> = {};
          if (r.title !== undefined) changes.title = r.title;
          if (r.description !== undefined) changes.description = r.description;
          if (r.price !== undefined) changes.basePrice = r.price;
          if (r.compareAt !== undefined) changes.compareAtPrice = r.compareAt;
          if (r.stock !== undefined) changes.stockQuantity = r.stock;
          if (r.featured !== undefined) changes.featured = r.featured;
          if (Object.keys(changes).length) {
            await manager.update(Product, { id: r.id }, changes);
            updated++;
          }
        } else {
          const saved = await manager.save(
            manager.create(Product, {
              title: r.title!,
              description: r.description,
              basePrice: r.price!,
              compareAtPrice: r.compareAt ?? null,
              stockQuantity: r.stock ?? null,
              featured: r.featured ?? false,
              shop,
            }),
          );
          createdIds.push(saved.id);
          created++;
        }
      }
    });
    if (createdIds.length && shop.status === ShopStatus.ACTIVE) {
      notifyInBackground(() => notifyFollowersOfNewProduct(createdIds[0]));
    }
    return res.json({ created, updated });
  } catch (error) {
    console.error("importMyProducts failed:", error);
    return res.status(500).json({ message: "Import failed — nothing was changed" });
  }
};

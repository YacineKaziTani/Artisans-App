import { Request, Response } from "express";
import { destroyUpload, type CloudinaryFile } from "../../lib/uploads";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Product } from "./product.entities";
import { ProductImage } from "./product-image.entities";
import { Shop, ShopStatus } from "../shop/shop.entities";
import { Order } from "../orders/order.entities";
import { canManageShopOf, findManageableProduct } from "./ownership";
import { notifyInBackground } from "../../notifications/deliver";
import { notifyFollowersOfNewProduct } from "../../notifications";

/** How many products a shop can pin to the top of its page. */
export const MAX_FEATURED = 6;

/** A sale price only makes sense above the real price. */
function compareAtProblem(price: number, compareAt: number | null | undefined) {
  if (compareAt == null) return null;
  return Number(compareAt) > Number(price)
    ? null
    : "The original price must be higher than the price — it's shown crossed out as a sale.";
}

async function featuredLimitReached(shopId: string, exceptProductId?: string) {
  const count = await AppDataSource.getRepository(Product)
    .createQueryBuilder("p")
    .where('p."shopId" = :shopId AND p.featured = true AND p."archivedAt" IS NULL', { shopId })
    .andWhere(exceptProductId ? "p.id <> :exceptProductId" : "TRUE", { exceptProductId })
    .getCount();
  return count >= MAX_FEATURED;
}
import {
  isUuid,
  pageResult,
  parsePagination,
  queryString,
} from "../../middleware/validate.middleware";

// Request bodies are validated by the zod schemas in product.schemas.ts.

const productRepo = AppDataSource.getRepository(Product);
const productImageRepo = AppDataSource.getRepository(ProductImage);
const shopRepo = AppDataSource.getRepository(Shop);
const orderRepo = AppDataSource.getRepository(Order);


function likePattern(value: unknown) {
  return `%${String(value).replace(/[\\%_]/g, "\\$&")}%`;
}

const PRODUCT_SORTS = {
  newest: ["product.createdAt", "DESC"],
  price_asc: ["product.basePrice", "ASC"],
  price_desc: ["product.basePrice", "DESC"],
  rating: ["shop.averageRating", "DESC"],
} as const;

/**
 * Public product listing, paginated. It used to return every product with
 * eight joined relations (images, options, values, variants…) — the home
 * page downloaded the whole catalogue to show 12 cards. A listing card only
 * needs the product, its shop, and whether it has options (to show "Select
 * options" instead of "Add to cart"); the full detail is GET /products/:id.
 */
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const shopId = queryString(req.query.shopId);
    const category = queryString(req.query.category);
    const search = queryString(req.query.search);
    const minPrice = Number(queryString(req.query.minPrice));
    const maxPrice = Number(queryString(req.query.maxPrice));
    const city = queryString(req.query.city);
    const minRating = Number(queryString(req.query.minRating));
    const inStock = queryString(req.query.inStock) === "true";
    const sortKey = queryString(req.query.sort) as keyof typeof PRODUCT_SORTS;
    const [sortColumn, sortDirection] =
      PRODUCT_SORTS[sortKey] ?? PRODUCT_SORTS.newest;
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 12,
      maxLimit: 48,
    });

    const qb = listingQuery();

    if (shopId && isUuid(shopId)) {
      qb.andWhere("shop.id = :shopId", { shopId });
    }
    if (category) {
      qb.andWhere("LOWER(category.name) = LOWER(:category)", { category });
    }
    if (search) {
      qb.andWhere(
        "(product.title ILIKE :search OR product.description ILIKE :search OR shop.shopName ILIKE :search)",
        { search: likePattern(search) },
      );
    }
    if (Number.isFinite(minPrice)) {
      qb.andWhere("product.basePrice >= :minPrice", { minPrice });
    }
    if (Number.isFinite(maxPrice)) {
      qb.andWhere("product.basePrice <= :maxPrice", { maxPrice });
    }
    if (city) {
      qb.andWhere("shop.city ILIKE :city", { city: likePattern(city) });
    }
    if (Number.isFinite(minRating) && minRating > 0) {
      qb.andWhere("shop.averageRating >= :minRating", { minRating });
    }
    if (inStock) {
      // Simple products: made to order (no count) or some left. Products
      // with options: at least one option in stock.
      qb.andWhere(`(
        (NOT EXISTS (SELECT 1 FROM "variant_options" vo WHERE vo."productId" = product.id)
          AND (product.stockQuantity IS NULL OR product.stockQuantity > 0))
        OR EXISTS (SELECT 1 FROM "product_variants" pv WHERE pv."productId" = product.id AND pv."stockQuantity" > 0)
      )`);
    }

    const [products, total] = await qb
      .orderBy(sortColumn, sortDirection)
      .addOrderBy("product.id", "ASC") // stable pages
      .skip(skip)
      .take(take)
      .getManyAndCount();

    res.json(pageResult(products, total, page, take));
  } catch (error) {
    console.error("getAllProducts failed:", error);
    res.status(500).json({ message: "Error fetching products" });
  }
};

/**
 * GET /products/trending?limit= — what's popular now: orders placed in
 * the last 14 days (card held or charged) weigh most, then page views in
 * the last 7, then the best-rated shops and the newest. A quiet
 * marketplace still gets a sensible row.
 */
export const getTrendingProducts = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(24, Math.max(1, Number(queryString(req.query.limit)) || 8));
    const ranked: { id: string }[] = await AppDataSource.query(
      `SELECT p.id
         FROM products p
         JOIN shops s ON s.id = p."shopId"
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS n FROM orders o
            WHERE o."productId" = p.id
              AND o."createdAt" > now() - interval '14 days'
              AND o."paymentStatus" IN ('authorized', 'paid')
         ) recent ON true
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(v.views), 0) AS n FROM product_views v
            WHERE v."productId" = p.id AND v.day >= (now() AT TIME ZONE 'UTC')::date - 6
         ) seen ON true
        WHERE s.status = 'active' AND p."archivedAt" IS NULL
        ORDER BY recent.n * 20 + seen.n DESC, s."averageRating" DESC, p."createdAt" DESC, p.id
        LIMIT $1`,
      [limit],
    );
    res.json(await productsInOrder(ranked.map((r) => r.id)));
  } catch (error) {
    console.error("getTrendingProducts failed:", error);
    res.status(500).json({ message: "Error fetching products" });
  }
};

/**
 * GET /products/:id/similar?limit= — "You may also like": other live
 * products in the same craft category, best-rated shops first.
 */
export const getSimilarProducts = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(24, Math.max(1, Number(queryString(req.query.limit)) || 8));
    const product = await productRepo.findOne({
      where: { id: String(req.params.id) },
      relations: { shop: { category: true } },
    });
    const categoryId = product?.shop?.category?.id;
    if (!product || !categoryId) return res.json([]);

    const similar = await listingQuery()
      .andWhere("category.id = :categoryId", { categoryId })
      .andWhere("product.id <> :id", { id: product.id })
      .orderBy("shop.averageRating", "DESC")
      .addOrderBy("product.createdAt", "DESC")
      .addOrderBy("product.id", "ASC")
      .take(limit)
      .getMany();
    res.json(similar);
  } catch (error) {
    console.error("getSimilarProducts failed:", error);
    res.status(500).json({ message: "Error fetching products" });
  }
};

/** The fields a product card needs, for live products of active shops. */
function listingQuery() {
  return productRepo
    .createQueryBuilder("product")
    .innerJoinAndSelect("product.shop", "shop")
    // Just the id, so the page can tell an artisan which products are theirs.
    .leftJoin("shop.owner", "owner")
    .addSelect(["owner.id"])
    .leftJoin("shop.category", "category")
    .leftJoin("product.variantOptions", "variantOptions")
    .addSelect(["variantOptions.id", "variantOptions.name"])
    .where("shop.status = :status", { status: "active" })
    .andWhere("product.archivedAt IS NULL");
}

/** Listing cards for these ids, in the given order. */
async function productsInOrder(ids: string[]) {
  if (ids.length === 0) return [];
  const found = await listingQuery().andWhere("product.id IN (:...ids)", { ids }).getMany();
  const byId = new Map(found.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

export const getMyProducts = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const products = await productRepo.find({
      where: { shop: { id: shop.id }, archivedAt: IsNull() },
      relations: [
        "images",
        "variantOptions",
        "variantOptions.values",
        "variants",
        "variants.values",
        "variants.values.option",
      ],
      order: { createdAt: "DESC" },
      relationLoadStrategy: "query",
    });
    res.json(products);
  } catch (error) {
    console.error("getMyProducts failed:", error);
    res.status(500).json({ message: "Error fetching products" });
  }
};

/**
 * One product with everything its page needs — gallery, options, variants
 * and the shop. Only live products of active shops are public.
 */
export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await productRepo.findOne({
      where: {
        id: String(req.params.id),
        archivedAt: IsNull(),
        shop: { status: ShopStatus.ACTIVE },
      },
      relations: {
        images: true,
        variantOptions: { values: true },
        variants: { values: { option: true } },
        shop: { category: true, owner: true },
      },
      // Not `order: { images: … }`: TypeORM builds invalid SQL for an
      // order on a relation under relationLoadStrategy "query".
      relationLoadStrategy: "query",
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    product.images?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return res.json(product);
  } catch (error) {
    console.error("getProductById failed:", error);
    return res.status(500).json({ message: "Error fetching product" });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  const file = req.file as CloudinaryFile | undefined;
  try {
    const { title, description, basePrice, stockQuantity, compareAtPrice, featured } = req.body;

    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) {
      // multer already uploaded the image; don't leave it orphaned.
      await destroyUpload(file?.filename);
      return res.status(404).json({ message: "You don't have a shop yet" });
    }
    const problem =
      compareAtProblem(basePrice, compareAtPrice) ??
      (featured && (await featuredLimitReached(shop.id))
        ? `You can feature at most ${MAX_FEATURED} products — unfeature one first.`
        : null);
    if (problem) {
      await destroyUpload(file?.filename);
      return res.status(400).json({ message: problem });
    }

    const saved = await productRepo.save(
      productRepo.create({
        title,
        description: description || undefined,
        basePrice,
        compareAtPrice: compareAtPrice ?? null,
        stockQuantity: stockQuantity ?? null,
        featured: featured ?? false,
        imageUrl: file?.path,
        shop,
      }),
    );

    if (file?.path) {
      await productImageRepo.save(
        productImageRepo.create({
          url: file.path,
          publicId: file.filename,
          product: saved,
        }),
      );
    }

    // Followers hear about it (at most one alert every few hours per shop).
    if (shop.status === ShopStatus.ACTIVE) {
      notifyInBackground(() => notifyFollowersOfNewProduct(saved.id));
    }

    return res.status(201).json(saved);
  } catch (error) {
    console.error("createProduct failed:", error);
    await destroyUpload(file?.filename);
    return res.status(500).json({ message: "Error creating product" });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { product, allowed } = await findManageableProduct(
      String(req.params.id),
      req.user!,
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const { title, description, basePrice, stockQuantity, compareAtPrice, featured } = req.body;
    const changes: Partial<Product> = {};
    if (title !== undefined) changes.title = title;
    if (description !== undefined) changes.description = description;
    if (basePrice !== undefined) changes.basePrice = basePrice;
    if (stockQuantity !== undefined) changes.stockQuantity = stockQuantity;
    if (compareAtPrice !== undefined) changes.compareAtPrice = compareAtPrice;
    if (featured !== undefined) changes.featured = featured;

    const problem = compareAtProblem(
      changes.basePrice ?? product.basePrice,
      compareAtPrice !== undefined ? compareAtPrice : product.compareAtPrice,
    );
    if (problem) return res.status(400).json({ message: problem });
    if (featured && !product.featured && (await featuredLimitReached(product.shop.id, product.id))) {
      return res.status(400).json({ message: `You can feature at most ${MAX_FEATURED} products — unfeature one first.` });
    }

    // update(), not save(): save() writes back the stock it read a moment
    // ago, which could undo a reservation a checkout made in between.
    if (Object.keys(changes).length) await productRepo.update(product.id, changes);
    return res.json(await productRepo.findOne({ where: { id: product.id } }));
  } catch (error) {
    console.error("updateProduct failed:", error);
    return res.status(500).json({ message: "Error updating product" });
  }
};

/**
 * A product that has been ordered is archived, not deleted: orders reference
 * it (so a hard delete failed with a foreign-key error) and clients' order
 * history should still show what they bought. A never-ordered product is
 * deleted outright, along with its uploaded images.
 */
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { product, allowed } = await findManageableProduct(
      String(req.params.id),
      req.user!,
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const hasOrders = await orderRepo.exists({
      where: { product: { id: product.id } },
    });
    if (hasOrders) {
      await productRepo.update(product.id, { archivedAt: new Date() });
      return res.status(204).send();
    }

    const images = await productImageRepo.find({
      where: { product: { id: product.id } },
    });
    await productRepo.remove(product);
    await Promise.all(images.map((image) => destroyUpload(image.publicId)));
    return res.status(204).send();
  } catch (error) {
    console.error("deleteProduct failed:", error);
    return res.status(500).json({ message: "Error deleting product" });
  }
};

export const addProductImage = async (req: Request, res: Response) => {
  const file = req.file as CloudinaryFile | undefined;
  try {
    if (!file?.path) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const { product, allowed } = await findManageableProduct(
      String(req.params.id),
      req.user!,
    );
    if (!product || !allowed) {
      await destroyUpload(file.filename);
      return product
        ? res.status(403).json({ message: "Forbidden" })
        : res.status(404).json({ message: "Product not found" });
    }

    const image = await productImageRepo.save(
      productImageRepo.create({
        url: file.path,
        publicId: file.filename,
        product,
      }),
    );

    if (!product.imageUrl) {
      await productRepo.update(product.id, { imageUrl: file.path });
    }

    return res.status(201).json(image);
  } catch (error) {
    console.error("addProductImage failed:", error);
    await destroyUpload(file?.filename);
    return res.status(500).json({ message: "Error adding product image" });
  }
};

export const removeProductImage = async (req: Request, res: Response) => {
  try {
    const imageId = String(req.params.imageId);

    const image = await productImageRepo.findOne({
      where: { id: imageId },
      relations: ["product", "product.shop", "product.shop.owner"],
    });
    if (!image) return res.status(404).json({ message: "Image not found" });
    if (!canManageShopOf(image.product.shop.owner?.id, req.user!)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const product = image.product;
    const wasCover = product.imageUrl === image.url;
    await productImageRepo.remove(image);
    await destroyUpload(image.publicId);

    if (wasCover) {
      const remaining = await productImageRepo.findOne({
        where: { product: { id: product.id } },
        order: { createdAt: "ASC" },
      });
      await productRepo.update(product.id, { imageUrl: remaining?.url ?? null });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("removeProductImage failed:", error);
    return res.status(500).json({ message: "Error removing product image" });
  }
};

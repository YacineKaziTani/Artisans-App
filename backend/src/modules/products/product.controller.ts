import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Product } from "./product.entities";
import { ProductImage } from "./product-image.entities";
import { Shop, ShopStatus } from "../shop/shop.entities";
import { Order } from "../orders/order.entities";
import { canManageShopOf, findManageableProduct } from "./ownership";
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

interface CloudinaryFile extends Omit<Express.Multer.File, "filename"> {
  filename?: string;
}

/** Best-effort removal of an uploaded image we no longer reference. */
async function destroyUpload(publicId: string | undefined | null) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("[cloudinary] couldn't delete", publicId, err);
  }
}

function likePattern(value: unknown) {
  return `%${String(value).replace(/[\\%_]/g, "\\$&")}%`;
}

const PRODUCT_SORTS = {
  newest: ["product.createdAt", "DESC"],
  price_asc: ["product.basePrice", "ASC"],
  price_desc: ["product.basePrice", "DESC"],
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
    const sortKey = queryString(req.query.sort) as keyof typeof PRODUCT_SORTS;
    const [sortColumn, sortDirection] =
      PRODUCT_SORTS[sortKey] ?? PRODUCT_SORTS.newest;
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 12,
      maxLimit: 48,
    });

    const qb = productRepo
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

    if (shopId && isUuid(shopId)) {
      qb.andWhere("shop.id = :shopId", { shopId });
    }
    if (category) {
      qb.andWhere("LOWER(category.name) = LOWER(:category)", { category });
    }
    if (search) {
      qb.andWhere(
        "(product.title ILIKE :search OR product.description ILIKE :search)",
        { search: likePattern(search) },
      );
    }
    if (Number.isFinite(minPrice)) {
      qb.andWhere("product.basePrice >= :minPrice", { minPrice });
    }
    if (Number.isFinite(maxPrice)) {
      qb.andWhere("product.basePrice <= :maxPrice", { maxPrice });
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
    const { title, description, basePrice, stockQuantity } = req.body;

    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) {
      // multer already uploaded the image; don't leave it orphaned.
      await destroyUpload(file?.filename);
      return res.status(404).json({ message: "You don't have a shop yet" });
    }

    const saved = await productRepo.save(
      productRepo.create({
        title,
        description: description || undefined,
        basePrice,
        stockQuantity: stockQuantity ?? null,
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

    const { title, description, basePrice, stockQuantity } = req.body;
    const changes: Partial<Product> = {};
    if (title !== undefined) changes.title = title;
    if (description !== undefined) changes.description = description;
    if (basePrice !== undefined) changes.basePrice = basePrice;
    if (stockQuantity !== undefined) changes.stockQuantity = stockQuantity;

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

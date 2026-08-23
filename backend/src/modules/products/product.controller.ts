import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { AppDataSource } from "../../data-source";
import { Product } from "./product.entities";
import { ProductImage } from "./product-image.entities";
import { Shop } from "../shop/shop.entities";
import { UserRole } from "../users/entities/user.entities";

const productRepo = AppDataSource.getRepository(Product);
const productImageRepo = AppDataSource.getRepository(ProductImage);
const shopRepo = AppDataSource.getRepository(Shop);

interface CloudinaryFile extends Omit<Express.Multer.File, "filename"> {
  filename?: string;
}

// All products (public) — filterable by shop, category (via the shop), a
// text search over title/description, and a price range.
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { shopId, category, search, minPrice, maxPrice } = req.query;

    const qb = productRepo
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.shop", "shop")
      .leftJoinAndSelect("shop.category", "category")
      .leftJoinAndSelect("product.images", "images")
      .where("shop.status = :status", { status: "active" });

    if (shopId) {
      qb.andWhere("shop.id = :shopId", { shopId });
    }
    if (category) {
      qb.andWhere("LOWER(category.name) = LOWER(:category)", { category });
    }
    if (search) {
      qb.andWhere(
        "(LOWER(product.title) LIKE LOWER(:search) OR LOWER(product.description) LIKE LOWER(:search))",
        { search: `%${search}%` },
      );
    }
    if (minPrice) {
      qb.andWhere("product.basePrice >= :minPrice", { minPrice });
    }
    if (maxPrice) {
      qb.andWhere("product.basePrice <= :maxPrice", { maxPrice });
    }

    const products = await qb.orderBy("product.createdAt", "DESC").getMany();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
  }
};

// Products on the logged-in artisan's own shop
export const getMyProducts = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const products = await productRepo.find({
      where: { shop: { id: shop.id } },
      relations: ["images"],
      order: { createdAt: "DESC" },
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
  }
};

// Create a product under the logged-in artisan's own shop
export const createProduct = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, description, basePrice } = req.body;
    const imageUrl = req.file?.path;

    if (!title || basePrice === undefined) {
      return res
        .status(400)
        .json({ message: "title and basePrice are required" });
    }

    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) {
      return res.status(404).json({ message: "You don't have a shop yet" });
    }

    const product = productRepo.create({
      title,
      description,
      basePrice,
      imageUrl,
      shop,
    });
    const saved = await productRepo.save(product);

    if (imageUrl) {
      const file = req.file as CloudinaryFile;
      await productImageRepo.save(
        productImageRepo.create({
          url: imageUrl,
          publicId: file.filename,
          product: saved,
        }),
      );
    }

    return res.status(201).json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error creating product", error });
  }
};

async function findOwnedProduct(id: string, userId: string, role?: UserRole) {
  const product = await productRepo.findOne({
    where: { id },
    relations: ["shop", "shop.owner"],
  });
  if (!product) return { product: null, allowed: false };
  const allowed =
    product.shop.owner.id === userId || role === UserRole.SUPER_ADMIN;
  return { product, allowed };
}

// Update a product owned by the logged-in artisan (or any product, for admins)
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { title, description, basePrice } = req.body;

    const { product, allowed } = await findOwnedProduct(id, userId, req.user!.role);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (basePrice !== undefined) product.basePrice = basePrice;

    const saved = await productRepo.save(product);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error updating product", error });
  }
};

// Delete a product owned by the logged-in artisan (or any product, for admins)
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const { product, allowed } = await findOwnedProduct(id, userId, req.user!.role);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await productRepo.remove(product);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Error deleting product", error });
  }
};

// Add an additional gallery image to a product. The first image ever
// uploaded also becomes/stays the cover image (product.imageUrl) for
// backward compatibility with existing product cards.
export const addProductImage = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const file = req.file as CloudinaryFile | undefined;

    if (!file?.path) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const { product, allowed } = await findOwnedProduct(id, userId, req.user!.role);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const image = await productImageRepo.save(
      productImageRepo.create({ url: file.path, publicId: file.filename, product }),
    );

    if (!product.imageUrl) {
      product.imageUrl = file.path;
      await productRepo.save(product);
    }

    return res.status(201).json(image);
  } catch (error) {
    return res.status(500).json({ message: "Error adding product image", error });
  }
};

// Remove a gallery image. If it was the cover image, promotes the next
// remaining image (if any) to be the new cover.
export const removeProductImage = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const imageId = String(req.params.imageId);

    const image = await productImageRepo.findOne({
      where: { id: imageId },
      relations: ["product", "product.shop", "product.shop.owner"],
    });
    if (!image) return res.status(404).json({ message: "Image not found" });

    const allowed =
      image.product.shop.owner.id === userId || req.user!.role === UserRole.SUPER_ADMIN;
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    if (image.publicId) {
      try {
        await cloudinary.uploader.destroy(image.publicId);
      } catch {
        // Non-fatal — still remove the DB record even if Cloudinary cleanup fails
      }
    }

    const product = image.product;
    const wasCover = product.imageUrl === image.url;
    await productImageRepo.remove(image);

    if (wasCover) {
      const remaining = await productImageRepo.findOne({
        where: { product: { id: product.id } },
        order: { createdAt: "ASC" },
      });
      product.imageUrl = remaining?.url;
      await productRepo.save(product);
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Error removing product image", error });
  }
};

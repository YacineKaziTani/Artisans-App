import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Product } from "./product.entities";
import { Shop } from "../shop/shop.entities";
import { UserRole } from "../users/entities/user.entities";

const productRepo = AppDataSource.getRepository(Product);
const shopRepo = AppDataSource.getRepository(Shop);

// All products (public), optionally filtered by shop
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.query;
    const where = shopId ? { shop: { id: String(shopId) } } : {};
    const products = await productRepo.find({
      where,
      relations: ["shop"],
      order: { createdAt: "DESC" },
    });
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

    return res.status(201).json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error creating product", error });
  }
};

// Update a product owned by the logged-in artisan (or any product, for admins)
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { title, description, basePrice } = req.body;
    const imageUrl = req.file?.path;

    const product = await productRepo.findOne({
      where: { id },
      relations: ["shop", "shop.owner"],
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (
      product.shop.owner.id !== userId &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (basePrice !== undefined) product.basePrice = basePrice;
    if (imageUrl) product.imageUrl = imageUrl;

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

    const product = await productRepo.findOne({
      where: { id },
      relations: ["shop", "shop.owner"],
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (
      product.shop.owner.id !== userId &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await productRepo.remove(product);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Error deleting product", error });
  }
};

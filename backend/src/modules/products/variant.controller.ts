import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Product } from "./product.entities";
import { VariantOption, VariantValue, ProductVariant } from "./variant.entities";
import { UserRole } from "../users/entities/user.entities";

const productRepo = AppDataSource.getRepository(Product);
const optionRepo = AppDataSource.getRepository(VariantOption);
const valueRepo = AppDataSource.getRepository(VariantValue);
const variantRepo = AppDataSource.getRepository(ProductVariant);

async function findOwnedProduct(productId: string, userId: string, role?: UserRole) {
  const product = await productRepo.findOne({
    where: { id: productId },
    relations: ["shop", "shop.owner"],
  });
  if (!product) return { product: null, allowed: false };
  const allowed = product.shop.owner.id === userId || role === UserRole.SUPER_ADMIN;
  return { product, allowed };
}

// ── Variant Options (e.g. "Size", "Color") ──────────────────────────────────

export const createVariantOption = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const productId = String(req.params.productId);
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    const { product, allowed } = await findOwnedProduct(productId, userId, req.user!.role);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const option = await optionRepo.save(
      optionRepo.create({ name: name.trim(), product }),
    );
    return res.status(201).json(option);
  } catch (error) {
    return res.status(500).json({ message: "Error creating variant option", error });
  }
};

export const deleteVariantOption = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const option = await optionRepo.findOne({
      where: { id },
      relations: ["product", "product.shop", "product.shop.owner"],
    });
    if (!option) return res.status(404).json({ message: "Option not found" });
    if (
      option.product.shop.owner.id !== userId &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await optionRepo.remove(option);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Error deleting variant option", error });
  }
};

// ── Variant Values (e.g. "M", "Red") ────────────────────────────────────────

export const createVariantValue = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const optionId = String(req.params.optionId);
    const { value, priceModifier } = req.body;

    if (!value?.trim()) {
      return res.status(400).json({ message: "value is required" });
    }

    const option = await optionRepo.findOne({
      where: { id: optionId },
      relations: ["product", "product.shop", "product.shop.owner"],
    });
    if (!option) return res.status(404).json({ message: "Option not found" });
    if (
      option.product.shop.owner.id !== userId &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const saved = await valueRepo.save(
      valueRepo.create({
        value: value.trim(),
        priceModifier: priceModifier ?? 0,
        option,
      }),
    );
    return res.status(201).json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error creating variant value", error });
  }
};

export const deleteVariantValue = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const value = await valueRepo.findOne({
      where: { id },
      relations: ["option", "option.product", "option.product.shop", "option.product.shop.owner"],
    });
    if (!value) return res.status(404).json({ message: "Value not found" });
    if (
      value.option.product.shop.owner.id !== userId &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await valueRepo.remove(value);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Error deleting variant value", error });
  }
};

// ── Product Variants (SKUs — a specific combination of values) ─────────────

export const createProductVariant = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const productId = String(req.params.productId);
    const { valueIds, sku, stockQuantity, priceOverride } = req.body;

    if (!Array.isArray(valueIds) || valueIds.length === 0) {
      return res.status(400).json({ message: "valueIds must be a non-empty array" });
    }

    const { product, allowed } = await findOwnedProduct(productId, userId, req.user!.role);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const values = await valueRepo.find({
      where: valueIds.map((id: string) => ({ id })),
      relations: ["option", "option.product"],
    });
    if (values.length !== new Set(valueIds).size) {
      return res.status(404).json({ message: "One or more values were not found" });
    }
    if (values.some((v) => v.option.product.id !== productId)) {
      return res
        .status(400)
        .json({ message: "All values must belong to options on this product" });
    }
    // One value per option per variant (can't be both Size=M and Size=L at once).
    const optionIds = values.map((v) => v.option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      return res
        .status(400)
        .json({ message: "Only one value per option is allowed per variant" });
    }

    const variant = await variantRepo.save(
      variantRepo.create({
        product,
        sku: sku || undefined,
        stockQuantity: stockQuantity ?? 0,
        priceOverride: priceOverride ?? undefined,
        values,
      }),
    );
    return res.status(201).json(variant);
  } catch (error) {
    return res.status(500).json({ message: "Error creating product variant", error });
  }
};

export const updateProductVariant = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { sku, stockQuantity, priceOverride } = req.body;

    const variant = await variantRepo.findOne({
      where: { id },
      relations: ["product", "product.shop", "product.shop.owner"],
    });
    if (!variant) return res.status(404).json({ message: "Variant not found" });
    if (
      variant.product.shop.owner.id !== userId &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (sku !== undefined) variant.sku = sku;
    if (stockQuantity !== undefined) variant.stockQuantity = stockQuantity;
    if (priceOverride !== undefined) variant.priceOverride = priceOverride;

    const saved = await variantRepo.save(variant);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error updating product variant", error });
  }
};

export const deleteProductVariant = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const variant = await variantRepo.findOne({
      where: { id },
      relations: ["product", "product.shop", "product.shop.owner"],
    });
    if (!variant) return res.status(404).json({ message: "Variant not found" });
    if (
      variant.product.shop.owner.id !== userId &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await variantRepo.remove(variant);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Error deleting product variant", error });
  }
};

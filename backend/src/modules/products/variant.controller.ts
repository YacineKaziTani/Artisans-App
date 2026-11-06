import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import {
  VariantOption,
  VariantValue,
  ProductVariant,
} from "./variant.entities";
import { canManageShopOf, findManageableProduct } from "./ownership";

// Request bodies are validated by the zod schemas in product.schemas.ts.

const optionRepo = AppDataSource.getRepository(VariantOption);
const valueRepo = AppDataSource.getRepository(VariantValue);
const variantRepo = AppDataSource.getRepository(ProductVariant);

const OWNER_RELATIONS = ["product", "product.shop", "product.shop.owner"];

export const createVariantOption = async (req: Request, res: Response) => {
  try {
    const { product, allowed } = await findManageableProduct(
      String(req.params.productId),
      req.user!,
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const option = await optionRepo.save(
      optionRepo.create({ name: req.body.name, product }),
    );
    return res.status(201).json(option);
  } catch (error) {
    console.error("createVariantOption failed:", error);
    return res.status(500).json({ message: "Error creating variant option" });
  }
};

export const deleteVariantOption = async (req: Request, res: Response) => {
  try {
    const option = await optionRepo.findOne({
      where: { id: String(req.params.id) },
      relations: OWNER_RELATIONS,
    });
    if (!option) return res.status(404).json({ message: "Option not found" });
    if (!canManageShopOf(option.product.shop.owner?.id, req.user!)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await optionRepo.remove(option);
    return res.status(204).send();
  } catch (error) {
    console.error("deleteVariantOption failed:", error);
    return res.status(500).json({ message: "Error deleting variant option" });
  }
};

// ── Variant Values (e.g. "M", "Red") ────────────────────────────────────────

export const createVariantValue = async (req: Request, res: Response) => {
  try {
    const option = await optionRepo.findOne({
      where: { id: String(req.params.optionId) },
      relations: OWNER_RELATIONS,
    });
    if (!option) return res.status(404).json({ message: "Option not found" });
    if (!canManageShopOf(option.product.shop.owner?.id, req.user!)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { value, priceModifier } = req.body;
    const saved = await valueRepo.save(
      valueRepo.create({ value, priceModifier: priceModifier ?? 0, option }),
    );
    return res.status(201).json(saved);
  } catch (error) {
    console.error("createVariantValue failed:", error);
    return res.status(500).json({ message: "Error creating variant value" });
  }
};

export const deleteVariantValue = async (req: Request, res: Response) => {
  try {
    const value = await valueRepo.findOne({
      where: { id: String(req.params.id) },
      relations: [
        "option",
        "option.product",
        "option.product.shop",
        "option.product.shop.owner",
      ],
    });
    if (!value) return res.status(404).json({ message: "Value not found" });
    if (!canManageShopOf(value.option.product.shop.owner?.id, req.user!)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await valueRepo.remove(value);
    return res.status(204).send();
  } catch (error) {
    console.error("deleteVariantValue failed:", error);
    return res.status(500).json({ message: "Error deleting variant value" });
  }
};

// ── Product Variants (SKUs — a specific combination of values) ─────────────

export const createProductVariant = async (req: Request, res: Response) => {
  try {
    const productId = String(req.params.productId);
    const { valueIds, sku, stockQuantity, priceOverride } = req.body as {
      valueIds: string[];
      sku?: string;
      stockQuantity?: number;
      priceOverride?: number | null;
    };

    const { product, allowed } = await findManageableProduct(
      productId,
      req.user!,
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const uniqueIds = [...new Set(valueIds)];
    const values = await valueRepo.find({
      where: uniqueIds.map((id) => ({ id })),
      relations: ["option", "option.product"],
    });
    if (values.length !== uniqueIds.length) {
      return res
        .status(404)
        .json({ message: "One or more values were not found" });
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
    console.error("createProductVariant failed:", error);
    return res.status(500).json({ message: "Error creating product variant" });
  }
};

export const updateProductVariant = async (req: Request, res: Response) => {
  try {
    const variant = await variantRepo.findOne({
      where: { id: String(req.params.id) },
      relations: OWNER_RELATIONS,
    });
    if (!variant) return res.status(404).json({ message: "Variant not found" });
    if (!canManageShopOf(variant.product.shop.owner?.id, req.user!)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { sku, stockQuantity, priceOverride } = req.body as {
      sku?: string;
      stockQuantity?: number;
      priceOverride?: number | null;
    };
    const changes: Partial<ProductVariant> = {};
    if (sku !== undefined) changes.sku = sku || null;
    if (stockQuantity !== undefined) changes.stockQuantity = stockQuantity;
    if (priceOverride !== undefined) changes.priceOverride = priceOverride;

    // update(), not save(): save() writes back the stock it read a moment
    // ago, which could undo a reservation a checkout made in between.
    if (Object.keys(changes).length) {
      await variantRepo.update(variant.id, changes);
    }
    return res.json(await variantRepo.findOne({ where: { id: variant.id } }));
  } catch (error) {
    console.error("updateProductVariant failed:", error);
    return res.status(500).json({ message: "Error updating product variant" });
  }
};

export const deleteProductVariant = async (req: Request, res: Response) => {
  try {
    const variant = await variantRepo.findOne({
      where: { id: String(req.params.id) },
      relations: OWNER_RELATIONS,
    });
    if (!variant) return res.status(404).json({ message: "Variant not found" });
    if (!canManageShopOf(variant.product.shop.owner?.id, req.user!)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await variantRepo.remove(variant);
    return res.status(204).send();
  } catch (error) {
    console.error("deleteProductVariant failed:", error);
    return res.status(500).json({ message: "Error deleting product variant" });
  }
};

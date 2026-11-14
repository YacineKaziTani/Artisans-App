import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { DiscountCode, DiscountKind } from "./discount-code.entities";
import { DiscountError, discountUses, normalizeCode, previewDiscount } from "./discounts";
import { Shop } from "../shop/shop.entities";
import { fromCents, toCents } from "../../lib/money";
import { isUniqueViolation } from "../../lib/db";

const codeRepo = AppDataSource.getRepository(DiscountCode);
const shopRepo = AppDataSource.getRepository(Shop);

const MAX_CODES_PER_SHOP = 50;

function myShop(userId: string) {
  return shopRepo.findOne({ where: { owner: { id: userId } } });
}

async function withUses(code: DiscountCode) {
  const { shop: _shop, ...rest } = code;
  return { ...rest, uses: await discountUses(AppDataSource.manager, code.id) };
}

/** GET /discounts/mine */
export const getMyDiscounts = async (req: Request, res: Response) => {
  try {
    const shop = await myShop(req.user!.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    const codes = await codeRepo.find({ where: { shop: { id: shop.id } }, order: { createdAt: "DESC" } });
    return res.json(await Promise.all(codes.map(withUses)));
  } catch (error) {
    console.error("getMyDiscounts failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** POST /discounts */
export const createDiscount = async (req: Request, res: Response) => {
  try {
    const shop = await myShop(req.user!.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if ((await codeRepo.count({ where: { shop: { id: shop.id } } })) >= MAX_CODES_PER_SHOP) {
      return res.status(400).json({ message: `A shop can have at most ${MAX_CODES_PER_SHOP} codes — delete old ones first` });
    }
    const { code, kind, value, minSubtotal, startsAt, expiresAt, maxUses } = req.body as {
      code: string;
      kind: DiscountKind;
      value?: number;
      minSubtotal?: number | null;
      startsAt?: Date | null;
      expiresAt?: Date | null;
      maxUses?: number | null;
    };
    try {
      const saved = await codeRepo.save(
        codeRepo.create({
          shop,
          code: normalizeCode(code),
          kind,
          value: kind === DiscountKind.FREE_DELIVERY ? 0 : value!,
          minSubtotal: minSubtotal ?? null,
          startsAt: startsAt ?? null,
          expiresAt: expiresAt ?? null,
          maxUses: maxUses ?? null,
          active: true,
        }),
      );
      return res.status(201).json(await withUses(saved));
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json({ message: "You already have a code with that name" });
      throw err;
    }
  } catch (error) {
    console.error("createDiscount failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** PATCH /discounts/:id — switch on/off, or change the end date / use limit. */
export const updateDiscount = async (req: Request, res: Response) => {
  try {
    const shop = await myShop(req.user!.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    const code = await codeRepo.findOne({ where: { id: String(req.params.id), shop: { id: shop.id } } });
    if (!code) return res.status(404).json({ message: "Code not found" });
    const { active, expiresAt, maxUses } = req.body as {
      active?: boolean;
      expiresAt?: Date | null;
      maxUses?: number | null;
    };
    if (active !== undefined) code.active = active;
    if (expiresAt !== undefined) code.expiresAt = expiresAt;
    if (maxUses !== undefined) code.maxUses = maxUses;
    return res.json(await withUses(await codeRepo.save(code)));
  } catch (error) {
    console.error("updateDiscount failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** DELETE /discounts/:id — orders keep the code's name, so history is unaffected. */
export const deleteDiscount = async (req: Request, res: Response) => {
  try {
    const shop = await myShop(req.user!.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    const result = await codeRepo.delete({ id: String(req.params.id), shop: { id: shop.id } });
    if (!result.affected) return res.status(404).json({ message: "Code not found" });
    return res.status(204).send();
  } catch (error) {
    console.error("deleteDiscount failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /discounts/check { shopId, code, subtotal } — what a code would take
 * off, before checkout. Checkout re-checks it (and is the one that counts).
 */
export const checkDiscount = async (req: Request, res: Response) => {
  try {
    const { shopId, code, subtotal } = req.body as { shopId: string; code: string; subtotal: number };
    try {
      const applied = await previewDiscount(shopId, code, toCents(subtotal));
      return res.json({
        valid: true,
        code: applied.code.code,
        kind: applied.code.kind,
        discount: fromCents(applied.itemsDiscountCents),
        freeDelivery: applied.freeDelivery,
      });
    } catch (err) {
      if (err instanceof DiscountError) return res.json({ valid: false, message: err.message });
      throw err;
    }
  } catch (error) {
    console.error("checkDiscount failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

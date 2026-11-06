import { IsNull } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Product } from "./product.entities";
import { UserRole } from "../users/entities/user.entities";
import type { SessionUser } from "../../middleware/auth.middleware";

/** The shop owner or an admin may manage a product and its variants. */
export function canManageShopOf(
  shopOwnerId: string | undefined,
  user: SessionUser,
) {
  return shopOwnerId === user.id || user.role === UserRole.SUPER_ADMIN;
}

/** Loads a live (non-archived) product with its owner, plus whether `user` may manage it. */
export async function findManageableProduct(
  productId: string,
  user: SessionUser,
) {
  const product = await AppDataSource.getRepository(Product).findOne({
    where: { id: productId, archivedAt: IsNull() },
    relations: ["shop", "shop.owner"],
  });
  if (!product) return { product: null, allowed: false };
  return { product, allowed: canManageShopOf(product.shop.owner?.id, user) };
}

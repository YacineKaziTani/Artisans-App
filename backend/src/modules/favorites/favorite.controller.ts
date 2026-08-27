import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Favorite, FavoriteTargetType } from "./favorite.entities";
import { Shop } from "../shop/shop.entities";
import { Product } from "../products/product.entities";
import { User } from "../users/entities/user.entities";

const favoriteRepo = AppDataSource.getRepository(Favorite);
const shopRepo = AppDataSource.getRepository(Shop);
const productRepo = AppDataSource.getRepository(Product);

export const toggleFavorite = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetType, targetId } = req.body;

    if (!Object.values(FavoriteTargetType).includes(targetType) || !targetId) {
      return res
        .status(400)
        .json({ message: "Invalid targetType or targetId" });
    }

    const targetExists =
      targetType === FavoriteTargetType.SHOP
        ? await shopRepo.exists({ where: { id: String(targetId) } })
        : await productRepo.exists({ where: { id: String(targetId) } });
    if (!targetExists) {
      return res.status(404).json({ message: "That item no longer exists" });
    }

    const existing = await favoriteRepo.findOne({
      where: { user: { id: userId }, targetType, targetId },
    });

    if (existing) {
      await favoriteRepo.remove(existing);
      return res.json({ favorited: false });
    }

    const favorite = favoriteRepo.create({
      user: { id: userId } as User,
      targetType,
      targetId,
    });
    await favoriteRepo.save(favorite);
    return res.json({ favorited: true });
  } catch (error) {
    return res.status(500).json({ message: "Error toggling favorite" });
  }
};

export const getMyFavoriteIds = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetType } = req.query;

    if (
      !Object.values(FavoriteTargetType).includes(
        targetType as FavoriteTargetType,
      )
    ) {
      return res.status(400).json({ message: "Invalid targetType" });
    }

    const favorites = await favoriteRepo.find({
      where: {
        user: { id: userId },
        targetType: targetType as FavoriteTargetType,
      },
    });
    return res.json(favorites.map((f) => f.targetId));
  } catch (error) {
    return res.status(500).json({ message: "Error fetching favorites" });
  }
};

export const getMyFavorites = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const favorites = await favoriteRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
    });

    const shopIds = favorites
      .filter((f) => f.targetType === FavoriteTargetType.SHOP)
      .map((f) => f.targetId);
    const productIds = favorites
      .filter((f) => f.targetType === FavoriteTargetType.PRODUCT)
      .map((f) => f.targetId);

    const [shops, products] = await Promise.all([
      shopIds.length
        ? shopRepo.find({
            where: shopIds.map((id) => ({ id })),
            relations: ["category"],
          })
        : [],
      productIds.length
        ? productRepo.find({
            where: productIds.map((id) => ({ id })),
            relations: ["shop", "images"],
          })
        : [],
    ]);

    return res.json({ shops, products });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching favorites" });
  }
};

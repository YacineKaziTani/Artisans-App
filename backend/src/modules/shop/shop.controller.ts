import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Shop, ShopStatus } from "./shop.entities";
import { Category } from "../category/category.entities";
import { User, UserRole } from "../users/entities/user.entities";

const shopRepo = AppDataSource.getRepository(Shop);
const userRepo = AppDataSource.getRepository(User);
const categoryRepo = AppDataSource.getRepository(Category);
export const uploadShopPhoto = async (req: Request, res: Response) => {
  try {
    const imageUrl = req.file?.path;
    if (!imageUrl) {
      return res.status(400).json({ message: "No image file provided" });
    }
    res.status(200).json({
      success: true,
      url: imageUrl,
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "Failed to upload image",
        error: error instanceof Error ? error.message : error,
      });
  }
};
export const createShop = async (req: Request, res: Response) => {
  try {
    const { shopName, description, address, city, phone, categoryId } =
      req.body;
    const imageUrl = req.file?.path;
    const userId = req.user!.id;

    const existing = await shopRepo.findOne({
      where: { owner: { id: userId } },
    });
    if (existing) {
      return res.status(400).json({ message: "You already have a shop" });
    }

    const category = await categoryRepo.findOne({
      where: { id: String(categoryId) },
    });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const owner = await userRepo.findOne({ where: { id: userId } });
    if (!owner) {
      return res.status(404).json({ message: "User not found" });
    }

    const shop = shopRepo.create({
      shopName,
      description,
      address,
      city,
      phone,
      category,
      logoUrl: imageUrl,
      owner,
      status: ShopStatus.PENDING,
    });

    const saved = await shopRepo.save(shop);

    await userRepo.update(userId, { role: UserRole.ARTISAN });

    return res.status(201).json({
      message: "Shop created waiting for approval",
      shop: saved,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

export const updateMyShop = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { shopName, description, address, city, phone, categoryId } =
      req.body;
    const imageUrl = req.file?.path;

    const shop = await shopRepo.findOne({
      where: { owner: { id: userId } },
      relations: { category: true },
    });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    if (shopName) shop.shopName = shopName;
    if (description) shop.description = description;
    if (address) shop.address = address;
    if (city) shop.city = city;
    if (phone) shop.phone = phone;
    if (imageUrl) shop.logoUrl = imageUrl;

    if (categoryId) {
      const category = await categoryRepo.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      shop.category = category;
    }

    const updated = await shopRepo.save(shop);
    return res.json({ message: "Shop updated", shop: updated });
  } catch (error) {
    return res.status(500).json({ message: "server error", error });
  }
};

export const getMyShop = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
      relations: {
        category: true,
        services: true,
        photos: true,
        products: true,
        reviews: { author: true },
      },
    });

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    return res.json(shop);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

export const getAllShops = async (req: Request, res: Response) => {
  try {
    const { category, city, search, page = "1", limit = "10" } = req.query;

    const qb = shopRepo
      .createQueryBuilder("shop")
      .leftJoinAndSelect("shop.category", "category")
      .leftJoinAndSelect("shop.owner", "owner")
      .leftJoinAndSelect("shop.photos", "photos")
      .where("shop.status = :status", { status: ShopStatus.ACTIVE });

    if (category) {
      qb.andWhere("LOWER(category.name) = LOWER(:category)", { category });
    }
    if (city) {
      qb.andWhere("LOWER(shop.city) LIKE LOWER(:city)", { city: `%${city}%` });
    }
    if (search) {
      qb.andWhere(
        "(LOWER(shop.shopName) LIKE LOWER(:search) OR LOWER(shop.description) LIKE LOWER(:search))",
        { search: `%${search}%` },
      );
    }

    const take = Math.min(Number(limit), 50);
    const skip = (Number(page) - 1) * take;

    const [shops, total] = await qb
      .orderBy("shop.averageRating", "DESC")
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return res.json({
      data: shops,
      meta: {
        total,
        page: Number(page),
        lastPage: Math.ceil(total / take),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "server error", error });
  }
};

export const getShopById = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: {
        id: String(req.params.id),
        status: ShopStatus.ACTIVE,
      },
      relations: {
        category: true,
        services: true,
        photos: true,
        products: true,
        reviews: { author: true },
        owner: true,
      },
    });

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    return res.json(shop);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// All shops regardless of status, for the super_admin dashboard
export const getAllShopsAdmin = async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;

    const qb = shopRepo
      .createQueryBuilder("shop")
      .leftJoinAndSelect("shop.category", "category")
      .leftJoinAndSelect("shop.owner", "owner");

    if (status) {
      qb.andWhere("shop.status = :status", { status });
    }

    const take = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * take;

    const [shops, total] = await qb
      .orderBy("shop.createdAt", "DESC")
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return res.json({
      data: shops,
      meta: { total, page: Number(page), lastPage: Math.ceil(total / take) },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Approve (activate) or suspend a shop (super_admin only)
export const updateShopStatus = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body as { status: ShopStatus };

    if (!Object.values(ShopStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const shop = await shopRepo.findOne({ where: { id } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    shop.status = status;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Shop status updated", shop: saved });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Artisan voluntarily closes their own shop. This is a soft close (status
// change), not a hard delete — bookings, orders, and reviews reference the
// shop without an onDelete cascade, so a hard delete would either fail on
// the foreign key or destroy financial/review history. A closed shop simply
// stops appearing in public listings (getAllShops/getShopById only return
// ACTIVE shops) and can be reopened later.
export const closeMyShop = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    shop.status = ShopStatus.CLOSED;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Shop closed", shop: saved });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

export const reopenMyShop = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (shop.status === ShopStatus.SUSPENDED) {
      return res
        .status(403)
        .json({ message: "This shop was suspended by an admin and can't be reopened directly" });
    }

    shop.status = ShopStatus.ACTIVE;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Shop reopened", shop: saved });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

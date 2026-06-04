import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Review } from "./review.entities";
import { Shop } from "../shop/shop.entities";
import { User } from "../users/entities/user.entities";

const reviewRepo = AppDataSource.getRepository(Review);
const shopRepo = AppDataSource.getRepository(Shop);

export const createReview = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params as { shopId: string };
    const { rating, comment } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!rating || rating < 1 || rating > 5)
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });

    const shop = await shopRepo.findOne({ where: { id: shopId } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const existing = await reviewRepo.findOne({
      where: { shop: { id: shopId }, author: { id: userId } },
    });
    if (existing)
      return res
        .status(409)
        .json({ message: "You already reviewed this shop" });

    const review = reviewRepo.create({
      rating,
      comment,
      shop,
      author: { id: userId } as User,
    });

    await reviewRepo.save(review);
    return res.status(201).json(review);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: err });
  }
};

export const getShopReviews = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params as { shopId: string };

    const reviews = await reviewRepo.find({
      where: { shop: { id: shopId } },
      relations: ["author"],
      order: { createdAt: "DESC" },
    });

    return res.status(200).json(reviews);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: err });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = (req as any).user?.id;

    const review = await reviewRepo.findOne({
      where: { id },
      relations: ["author"],
    });

    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.author.id !== userId)
      return res.status(403).json({ message: "Forbidden" });

    await reviewRepo.remove(review);
    return res.status(200).json({ message: "Review deleted" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: err });
  }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { rating, comment } = req.body;
    const userId = (req as any).user?.id;

    const review = await reviewRepo.findOne({
      where: { id },
      relations: ["author"],
    });

    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.author.id !== userId)
      return res.status(403).json({ message: "Forbidden" });

    if (rating !== undefined) {
      if (rating < 1 || rating > 5)
        return res
          .status(400)
          .json({ message: "Rating must be between 1 and 5" });
      review.rating = rating;
    }
    if (comment !== undefined) review.comment = comment;

    await reviewRepo.save(review);
    return res.status(200).json(review);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: err });
  }
};

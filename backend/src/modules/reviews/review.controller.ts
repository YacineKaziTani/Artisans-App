import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Review } from "./review.entities";
import { Shop } from "../shop/shop.entities";
import { User, UserRole } from "../users/entities/user.entities";
import { Booking, BookingStatus } from "../booking/booking.entities";
import { Order, OrderStatus } from "../orders/order.entities";
import { isUniqueViolation } from "../../lib/db";

// Request bodies are validated by the zod schemas in review.schemas.ts.

const reviewRepo = AppDataSource.getRepository(Review);
const shopRepo = AppDataSource.getRepository(Shop);
const bookingRepo = AppDataSource.getRepository(Booking);
const orderRepo = AppDataSource.getRepository(Order);

const REVIEW_SELECT = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  author: { id: true, name: true, avatarUrl: true },
} as const;

type IneligibleReason = "own_shop" | "already_reviewed" | "no_completed_purchase";

const INELIGIBLE_MESSAGES: Record<IneligibleReason, string> = {
  own_shop: "You can't review your own shop",
  already_reviewed: "You already reviewed this shop",
  no_completed_purchase:
    "You can review this shop after a completed booking or a fulfilled order",
};

async function recalculateShopRating(shopId: string) {
  const { avg } = await reviewRepo
    .createQueryBuilder("review")
    .select("AVG(review.rating)", "avg")
    .where("review.shopId = :shopId", { shopId })
    .getRawOne();

  await shopRepo.update(shopId, { averageRating: avg ? Number(avg) : 0 });
}

/**
 * Only real customers can review: someone with a completed booking or a
 * fulfilled order at the shop, and never the shop's owner. Without this,
 * anyone — including the artisan — could post ratings.
 */
async function reviewEligibility(
  shop: Shop & { owner?: User },
  userId: string,
): Promise<IneligibleReason | null> {
  if (shop.owner?.id === userId) return "own_shop";

  const alreadyReviewed = await reviewRepo.exists({
    where: { shop: { id: shop.id }, author: { id: userId } },
  });
  if (alreadyReviewed) return "already_reviewed";

  const [booked, ordered] = await Promise.all([
    bookingRepo.exists({
      where: {
        shop: { id: shop.id },
        client: { id: userId },
        status: BookingStatus.COMPLETED,
      },
    }),
    orderRepo.exists({
      where: {
        shop: { id: shop.id },
        client: { id: userId },
        status: OrderStatus.FULFILLED,
      },
    }),
  ]);
  return booked || ordered ? null : "no_completed_purchase";
}

export const getReviewEligibility = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { id: String(req.params.shopId) },
      relations: ["owner"],
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const reason = await reviewEligibility(shop, req.user!.id);
    return res.json({
      canReview: reason === null,
      reason,
      message: reason ? INELIGIBLE_MESSAGES[reason] : null,
    });
  } catch (err) {
    console.error("getReviewEligibility failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createReview = async (req: Request, res: Response) => {
  try {
    const shopId = String(req.params.shopId);
    const userId = req.user!.id;
    const { rating, comment } = req.body as { rating: number; comment?: string };

    const shop = await shopRepo.findOne({
      where: { id: shopId },
      relations: ["owner"],
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const reason = await reviewEligibility(shop, userId);
    if (reason) {
      return res
        .status(reason === "already_reviewed" ? 409 : 403)
        .json({ message: INELIGIBLE_MESSAGES[reason] });
    }

    const review = reviewRepo.create({
      rating,
      comment: comment || undefined,
      shop,
      author: { id: userId } as User,
    });
    try {
      await reviewRepo.save(review);
    } catch (err) {
      // The (shop, author) unique constraint caught a double submit.
      if (isUniqueViolation(err)) {
        return res
          .status(409)
          .json({ message: INELIGIBLE_MESSAGES.already_reviewed });
      }
      throw err;
    }
    await recalculateShopRating(shopId);

    const saved = await reviewRepo.findOne({
      where: { id: review.id },
      relations: ["author"],
      select: REVIEW_SELECT,
    });
    return res.status(201).json(saved);
  } catch (err) {
    console.error("createReview failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getShopReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await reviewRepo.find({
      where: { shop: { id: String(req.params.shopId) } },
      relations: ["author"],
      select: REVIEW_SELECT,
      order: { createdAt: "DESC" },
    });
    return res.status(200).json(reviews);
  } catch (err) {
    console.error("getShopReviews failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const review = await reviewRepo.findOne({
      where: { id: String(req.params.id) },
      relations: ["author", "shop"],
    });
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (
      review.author.id !== req.user!.id &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const shopId = review.shop.id;
    await reviewRepo.remove(review);
    await recalculateShopRating(shopId);

    return res.status(200).json({ message: "Review deleted" });
  } catch (err) {
    console.error("deleteReview failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const review = await reviewRepo.findOne({
      where: { id },
      relations: ["author", "shop"],
    });
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.author.id !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { rating, comment } = req.body as { rating?: number; comment?: string };
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    await reviewRepo.save(review);
    await recalculateShopRating(review.shop.id);

    return res.status(200).json(
      await reviewRepo.findOne({
        where: { id },
        relations: ["author"],
        select: REVIEW_SELECT,
      }),
    );
  } catch (err) {
    console.error("updateReview failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

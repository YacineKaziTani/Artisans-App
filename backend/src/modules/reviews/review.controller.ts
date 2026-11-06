import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { MAX_REVIEW_PHOTOS, Review } from "./review.entities";
import { Product } from "../products/product.entities";
import { destroyUpload, type CloudinaryFile } from "../../lib/uploads";
import { Shop } from "../shop/shop.entities";
import { User, UserRole } from "../users/entities/user.entities";
import { Booking, BookingStatus } from "../booking/booking.entities";
import { Order, OrderStatus } from "../orders/order.entities";
import { isUniqueViolation } from "../../lib/db";
import { notifyInBackground } from "../../notifications/deliver";
import { notifyReviewReplied } from "../../notifications";

// Request bodies are validated by the zod schemas in review.schemas.ts.

const reviewRepo = AppDataSource.getRepository(Review);
const shopRepo = AppDataSource.getRepository(Shop);
const bookingRepo = AppDataSource.getRepository(Booking);
const orderRepo = AppDataSource.getRepository(Order);

const REVIEW_SELECT = {
  id: true,
  rating: true,
  comment: true,
  photos: true,
  reply: true,
  repliedAt: true,
  createdAt: true,
  author: { id: true, name: true, avatarUrl: true },
  product: { id: true, title: true },
} as const;
const REVIEW_RELATIONS = ["author", "product"];

/** Products this client received from this shop (fulfilled orders) — the ones a review may be about. */
async function purchasedProducts(shopId: string, userId: string) {
  const rows: { id: string; title: string }[] = await AppDataSource.query(
    `SELECT DISTINCT p.id, p.title
       FROM orders o JOIN products p ON p.id = o."productId"
      WHERE o."shopId" = $1 AND o."clientId" = $2 AND o.status = 'fulfilled'
      ORDER BY p.title`,
    [shopId, userId],
  );
  return rows;
}

/** null = fine; otherwise why the product can't be attached. */
async function checkReviewProduct(shopId: string, userId: string, productId: string | null | undefined) {
  if (!productId) return null;
  const bought = await purchasedProducts(shopId, userId);
  return bought.some((p) => p.id === productId)
    ? null
    : "You can only tag a product you've received from this shop";
}

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
      // What the review can be tagged with.
      products: reason === null ? await purchasedProducts(shop.id, req.user!.id) : [],
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
    const { rating, comment, productId } = req.body as {
      rating: number;
      comment?: string;
      productId?: string;
    };

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

    const productProblem = await checkReviewProduct(shopId, userId, productId);
    if (productProblem) return res.status(400).json({ message: productProblem, field: "productId" });

    const review = reviewRepo.create({
      rating,
      comment: comment || undefined,
      shop,
      author: { id: userId } as User,
      product: productId ? ({ id: productId } as Product) : null,
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
      relations: REVIEW_RELATIONS,
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
      relations: REVIEW_RELATIONS,
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
    const photos = review.photos ?? [];
    await reviewRepo.remove(review);
    await recalculateShopRating(shopId);
    await Promise.all(photos.map((p) => destroyUpload(p.publicId)));

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

    const { rating, comment, productId } = req.body as {
      rating?: number;
      comment?: string;
      productId?: string | null;
    };
    if (productId !== undefined) {
      const productProblem = await checkReviewProduct(review.shop.id, req.user!.id, productId);
      if (productProblem) return res.status(400).json({ message: productProblem, field: "productId" });
      review.product = productId ? ({ id: productId } as Product) : null;
    }
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    await reviewRepo.save(review);
    await recalculateShopRating(review.shop.id);

    return res.status(200).json(
      await reviewRepo.findOne({
        where: { id },
        relations: REVIEW_RELATIONS,
        select: REVIEW_SELECT,
      }),
    );
  } catch (err) {
    console.error("updateReview failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** GET /reviews/product/:productId — reviews that are about this product. */
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await reviewRepo.find({
      where: { product: { id: String(req.params.productId) } },
      relations: REVIEW_RELATIONS,
      select: REVIEW_SELECT,
      order: { createdAt: "DESC" },
      take: 50,
    });
    return res.json(reviews);
  } catch (err) {
    console.error("getProductReviews failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** PUT /reviews/:id/reply — the shop owner's public answer (empty clears it). */
export const replyToReview = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const review = await reviewRepo.findOne({
      where: { id },
      relations: ["shop", "shop.owner", "author"],
    });
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.shop.owner?.id !== req.user!.id) {
      return res.status(403).json({ message: "Only the shop's owner can reply" });
    }

    const reply = ((req.body as { reply?: string }).reply ?? "").trim();
    const isNewReply = Boolean(reply) && !review.reply;
    review.reply = reply || null;
    review.repliedAt = reply ? new Date() : null;
    await reviewRepo.save(review);
    if (isNewReply) notifyInBackground(() => notifyReviewReplied(review.id));

    return res.json(
      await reviewRepo.findOne({ where: { id }, relations: REVIEW_RELATIONS, select: REVIEW_SELECT }),
    );
  } catch (err) {
    console.error("replyToReview failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** POST /reviews/:id/photos — the author adds a photo (up to MAX_REVIEW_PHOTOS). */
export const addReviewPhoto = async (req: Request, res: Response) => {
  const file = req.file as CloudinaryFile | undefined;
  try {
    if (!file?.path || !file.filename) {
      return res.status(400).json({ message: "Choose an image to upload" });
    }
    const review = await reviewRepo.findOne({
      where: { id: String(req.params.id) },
      relations: ["author"],
    });
    if (!review || review.author.id !== req.user!.id) {
      await destroyUpload(file.filename);
      return res.status(review ? 403 : 404).json({ message: review ? "Forbidden" : "Review not found" });
    }
    const photos = review.photos ?? [];
    if (photos.length >= MAX_REVIEW_PHOTOS) {
      await destroyUpload(file.filename);
      return res.status(400).json({ message: `A review can have at most ${MAX_REVIEW_PHOTOS} photos` });
    }

    review.photos = [...photos, { url: file.path, publicId: file.filename }];
    await reviewRepo.save(review);
    return res.status(201).json(
      await reviewRepo.findOne({ where: { id: review.id }, relations: REVIEW_RELATIONS, select: REVIEW_SELECT }),
    );
  } catch (err) {
    console.error("addReviewPhoto failed:", err);
    await destroyUpload(file?.filename);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** DELETE /reviews/:id/photos/:index — the author (or an admin) removes a photo. */
export const removeReviewPhoto = async (req: Request, res: Response) => {
  try {
    const index = Number(req.params.index);
    const review = await reviewRepo.findOne({
      where: { id: String(req.params.id) },
      relations: ["author"],
    });
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.author.id !== req.user!.id && req.user!.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const photos = review.photos ?? [];
    if (!Number.isInteger(index) || index < 0 || index >= photos.length) {
      return res.status(404).json({ message: "Photo not found" });
    }

    const [removed] = photos.splice(index, 1);
    review.photos = photos.length ? photos : null;
    await reviewRepo.save(review);
    await destroyUpload(removed.publicId);
    return res.json(
      await reviewRepo.findOne({ where: { id: review.id }, relations: REVIEW_RELATIONS, select: REVIEW_SELECT }),
    );
  } catch (err) {
    console.error("removeReviewPhoto failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

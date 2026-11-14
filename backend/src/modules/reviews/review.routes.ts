import { Router } from "express";
import {
  createReview,
  getShopReviews,
  deleteReview,
  updateReview,
  getReviewEligibility,
  getProductReviews,
  replyToReview,
  addReviewPhoto,
  removeReviewPhoto,
  getReviewHighlights,
} from "./review.controller";
import { parser } from "../../config/cloudinary";
import { authMiddleware, requireVerifiedEmail } from "../../middleware/auth.middleware";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import { createReviewSchema, reviewReplySchema, updateReviewSchema } from "./review.schemas";

const router = Router();

router.param("id", uuidParam);
router.param("shopId", uuidParam);
router.param("productId", uuidParam);

router.get("/highlights", getReviewHighlights);
router.get("/product/:productId", getProductReviews);
router.put("/:id/reply", authMiddleware, validateBody(reviewReplySchema), replyToReview);
router.post("/:id/photos", authMiddleware, parser.single("image"), addReviewPhoto);
router.delete("/:id/photos/:index", authMiddleware, removeReviewPhoto);

router.get("/shop/:shopId", getShopReviews);
router.get("/shop/:shopId/eligibility", authMiddleware, getReviewEligibility);
router.post(
  "/shop/:shopId",
  authMiddleware,
  requireVerifiedEmail,
  validateBody(createReviewSchema),
  createReview,
);
router.patch("/:id", authMiddleware, validateBody(updateReviewSchema), updateReview);
router.delete("/:id", authMiddleware, deleteReview);

export default router;

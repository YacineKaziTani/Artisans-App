import { Router } from "express";
import {
  createReview,
  getShopReviews,
  deleteReview,
  updateReview,
  getReviewEligibility,
} from "./review.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import { createReviewSchema, updateReviewSchema } from "./review.schemas";

const router = Router();

router.param("id", uuidParam);
router.param("shopId", uuidParam);

router.get("/shop/:shopId", getShopReviews);
router.get("/shop/:shopId/eligibility", authMiddleware, getReviewEligibility);
router.post(
  "/shop/:shopId",
  authMiddleware,
  validateBody(createReviewSchema),
  createReview,
);
router.patch("/:id", authMiddleware, validateBody(updateReviewSchema), updateReview);
router.delete("/:id", authMiddleware, deleteReview);

export default router;

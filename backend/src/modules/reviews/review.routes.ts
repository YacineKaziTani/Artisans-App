import { Router } from "express";
import {
  createReview,
  getShopReviews,
  deleteReview,
  updateReview,
} from "./review.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.get("/shop/:shopId", getShopReviews);
router.post("/shop/:shopId", authMiddleware, createReview);
router.patch("/:id", authMiddleware, updateReview);
router.delete("/:id", authMiddleware, deleteReview);

export default router;

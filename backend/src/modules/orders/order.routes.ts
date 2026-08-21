import { Router } from "express";
import {
  createOrder,
  createCartCheckout,
  getMyOrders,
  getShopOrders,
  updateOrderStatus,
  cancelMyOrder,
  getAllOrdersAdmin,
} from "./order.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { paymentLimiter } from "../../middleware/rate-limit.middleware";
import { UserRole } from "../users/entities/user.entities";

const router = Router();

router.post("/", authMiddleware, paymentLimiter, createOrder);
router.post("/checkout", authMiddleware, paymentLimiter, createCartCheckout);
router.get("/mine", authMiddleware, getMyOrders);
router.get("/shop", authMiddleware, authorize(UserRole.ARTISAN), getShopOrders);
router.get(
  "/admin/all",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getAllOrdersAdmin,
);
router.patch(
  "/:id/status",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  updateOrderStatus,
);
router.patch("/:id/cancel", authMiddleware, cancelMyOrder);

export default router;

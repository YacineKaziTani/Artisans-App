import { Router } from "express";
import {
  createOrder,
  createCartCheckout,
  getMyOrders,
  getShopOrders,
  updateOrderStatus,
  cancelMyOrder,
  getAllOrdersAdmin,
  abandonMyCheckout,
  confirmOrderReceived,
} from "./order.controller";
import { authMiddleware, requireVerifiedEmail } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { paymentLimiter } from "../../middleware/rate-limit.middleware";
import { UserRole } from "../users/entities/user.entities";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import {
  abandonCheckoutSchema,
  cartCheckoutSchema,
  createOrderSchema,
  orderStatusSchema,
} from "./order.schemas";
import { auditAdmin } from "../audit/audit";

const router = Router();

router.param("id", uuidParam);

router.post(
  "/",
  authMiddleware,
  requireVerifiedEmail,
  paymentLimiter,
  validateBody(createOrderSchema),
  createOrder,
);
router.post(
  "/checkout",
  authMiddleware,
  requireVerifiedEmail,
  paymentLimiter,
  validateBody(cartCheckoutSchema),
  createCartCheckout,
);
router.post(
  "/abandon",
  authMiddleware,
  validateBody(abandonCheckoutSchema),
  abandonMyCheckout,
);
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
  validateBody(orderStatusSchema),
  auditAdmin("order.status_changed", "order"),
  updateOrderStatus,
);
router.patch("/:id/cancel", authMiddleware, cancelMyOrder);
router.patch("/:id/received", authMiddleware, confirmOrderReceived);

export default router;

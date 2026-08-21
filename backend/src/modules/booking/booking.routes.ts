import { Router } from "express";
import {
  createBooking,
  getMyBookings,
  getShopBookings,
  updateBookingStatus,
  cancelMyBooking,
  getAllBookingsAdmin,
} from "./booking.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { paymentLimiter } from "../../middleware/rate-limit.middleware";
import { UserRole } from "../users/entities/user.entities";

const router = Router();

router.post("/", authMiddleware, paymentLimiter, createBooking);
router.get("/mine", authMiddleware, getMyBookings);
router.get("/shop", authMiddleware, authorize(UserRole.ARTISAN), getShopBookings);
router.get(
  "/admin/all",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getAllBookingsAdmin,
);
router.patch(
  "/:id/status",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  updateBookingStatus,
);
router.patch("/:id/cancel", authMiddleware, cancelMyBooking);

export default router;

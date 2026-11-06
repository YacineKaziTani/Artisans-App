import { Router } from "express";
import {
  createBooking,
  getMyBookings,
  getShopBookings,
  updateBookingStatus,
  cancelMyBooking,
  getAllBookingsAdmin,
  abandonMyBooking,
} from "./booking.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { paymentLimiter } from "../../middleware/rate-limit.middleware";
import { UserRole } from "../users/entities/user.entities";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import { bookingStatusSchema, createBookingSchema } from "./booking.schemas";

const router = Router();

router.param("id", uuidParam);

router.post(
  "/",
  authMiddleware,
  paymentLimiter,
  validateBody(createBookingSchema),
  createBooking,
);
router.get("/mine", authMiddleware, getMyBookings);
router.get(
  "/shop",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  getShopBookings,
);
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
  validateBody(bookingStatusSchema),
  updateBookingStatus,
);
router.patch("/:id/cancel", authMiddleware, cancelMyBooking);
router.post("/:id/abandon", authMiddleware, abandonMyBooking);

export default router;

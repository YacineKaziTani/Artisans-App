import { Router } from "express";
import {
  createShop,
  updateMyShop,
  updateMyHours,
  updateMyDelivery,
  getMyEarnings,
  getMyStripeDashboardLink,
  getMyShop,
  getAllShops,
  getShopById,
  getAllShopsAdmin,
  updateShopStatus,
  closeMyShop,
  reopenMyShop,
  requestShopVerification,
  resolveShopVerification,
  connectStripeAccount,
  getStripeAccountStatus,
  getMyShopStats,
  getShopAdmin,
  uploadMyCover,
  removeMyCover,
} from "./shop.controller";
import { authorize } from "../../middleware/authorize.middleware";
import { authMiddleware, requireVerifiedEmail } from "../../middleware/auth.middleware";
import { UserRole } from "../users/entities/user.entities";
import { parser } from "../../config/cloudinary";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import {
  createShopSchema,
  shopDeliverySchema,
  shopHoursSchema,
  resolveVerificationSchema,
  shopStatusSchema,
  updateShopSchema,
} from "./shop.schemas";
import { auditAdmin } from "../audit/audit";
import {
  getMyAnalytics,
  getMyCalendarFeed,
  resetMyCalendarFeed,
  updateMyHoliday,
  updateMyStockAlerts,
} from "./shop-tools.controller";
import { shopHolidaySchema, shopStockAlertsSchema } from "./shop.schemas";

const router = Router();

// Reject malformed ids with a 404 instead of a Postgres cast error.
router.param("id", uuidParam);

router.get("/", getAllShops);
router.get("/mine", authMiddleware, getMyShop);
router.get(
  "/mine/earnings",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  getMyEarnings,
);
router.post(
  "/mine/stripe-dashboard",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  getMyStripeDashboardLink,
);
router.put(
  "/mine/hours",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  validateBody(shopHoursSchema),
  updateMyHours,
);
router.put(
  "/mine/delivery",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  validateBody(shopDeliverySchema),
  updateMyDelivery,
);
router.put("/mine/holiday", authMiddleware, authorize(UserRole.ARTISAN), validateBody(shopHolidaySchema), updateMyHoliday);
router.put(
  "/mine/stock-alerts",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  validateBody(shopStockAlertsSchema),
  updateMyStockAlerts,
);
router.get("/mine/calendar", authMiddleware, authorize(UserRole.ARTISAN), getMyCalendarFeed);
router.post("/mine/calendar/reset", authMiddleware, authorize(UserRole.ARTISAN), resetMyCalendarFeed);
router.get("/mine/analytics", authMiddleware, authorize(UserRole.ARTISAN), getMyAnalytics);
router.put(
  "/mine/cover",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  parser.single("image"),
  uploadMyCover,
);
router.delete("/mine/cover", authMiddleware, authorize(UserRole.ARTISAN), removeMyCover);
router.put(
  "/mine",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  parser.single("image"),
  validateBody(updateShopSchema),
  updateMyShop,
);

router.post(
  "/create",
  authMiddleware,
  authorize(UserRole.CLIENT, UserRole.ARTISAN),
  requireVerifiedEmail,
  parser.single("image"),
  validateBody(createShopSchema),
  createShop,
);
router.patch(
  "/mine/close",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  closeMyShop,
);
router.patch(
  "/mine/reopen",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  reopenMyShop,
);
router.patch(
  "/mine/request-verification",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  requestShopVerification,
);
router.patch(
  "/:id/verification",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(resolveVerificationSchema),
  auditAdmin("shop.verification_resolved", "shop"),
  resolveShopVerification,
);
router.post(
  "/mine/connect-stripe",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  connectStripeAccount,
);
router.get(
  "/mine/stripe-status",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  getStripeAccountStatus,
);
router.get(
  "/mine/stats",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  getMyShopStats,
);
router.get("/:id", getShopById);

router.get(
  "/admin/all",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getAllShopsAdmin,
);
// After /admin/all: the :id param check would otherwise reject "all".
router.get(
  "/admin/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getShopAdmin,
);
router.patch(
  "/:id/status",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(shopStatusSchema),
  auditAdmin("shop.status_changed", "shop"),
  updateShopStatus,
);

export default router;

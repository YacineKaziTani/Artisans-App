import { Router } from "express";
import {
  createShop,
  updateMyShop,
  getMyShop,
  getAllShops,
  getShopById,
  uploadShopPhoto,
  getAllShopsAdmin,
  updateShopStatus,
  closeMyShop,
  reopenMyShop,
  requestShopVerification,
  resolveShopVerification,
  connectStripeAccount,
  getStripeAccountStatus,
} from "./shop.controller";
import { authorize } from "../../middleware/authorize.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { UserRole } from "../users/entities/user.entities";
import { parser } from "../../config/cloudinary";
import { uuidParam } from "../../middleware/validate.middleware";

const router = Router();

// Reject malformed ids with a 404 instead of a Postgres cast error.
router.param("id", uuidParam);

router.post(
  "/upload-photo",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  parser.single("image"),
  uploadShopPhoto,
);
router.get("/", getAllShops);
router.get("/mine", authMiddleware, getMyShop);
router.put(
  "/mine",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  parser.single("image"),
  updateMyShop,
);

router.post(
  "/create",
  authMiddleware,
  authorize(UserRole.CLIENT, UserRole.ARTISAN),
  parser.single("image"),
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
router.get("/:id", getShopById);

router.get(
  "/admin/all",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getAllShopsAdmin,
);
router.patch(
  "/:id/status",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  updateShopStatus,
);

export default router;

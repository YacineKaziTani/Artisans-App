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
} from "./shop.controller";
import { authorize } from "../../middleware/authorize.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { UserRole } from "../users/entities/user.entities";
import { parser } from "../../config/cloudinary";

const router = Router();
router.post(
  "/upload-photo",
  authMiddleware,
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
  authorize(UserRole.ARTISAN),
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

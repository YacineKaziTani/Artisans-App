import { Router } from "express";
import {
  createShop,
  updateMyShop,
  getMyShop,
  getAllShops,
  getShopById,
  uploadShopPhoto,
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
router.put("/mine", authMiddleware, authorize(UserRole.ARTISAN), updateMyShop);

router.post(
  "/create",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  parser.single("image"),
  createShop,
);
router.get("/:id", getShopById);

export default router;

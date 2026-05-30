import { Router } from "express";
import {
  createShop,
  updateMyShop,
  getMyShop,
  getAllShops,
  getShopById,
} from "./shop.controller";
import { authorize } from "../../middleware/authorize.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { UserRole } from "../users/entities/user.entities";

const router = Router();

router.get("/", getAllShops);
router.get("/:id", getShopById);

router.post(
  "/",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.CLIENT),
  createShop,
);
router.get("/mine", authMiddleware, getMyShop);
router.put("/mine", authMiddleware, authorize(UserRole.ARTISAN), updateMyShop);

export default router;

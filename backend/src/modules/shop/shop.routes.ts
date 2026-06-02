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
import { UserRole } from "../users/user.entities";

const router = Router();

router.get("/", getAllShops);
router.get("/mine", authMiddleware, getMyShop);
router.put("/mine", authMiddleware, authorize(UserRole.ARTISAN), updateMyShop);

router.post("/", authMiddleware, authorize(UserRole.ARTISAN), createShop);
router.get("/:id", getShopById);

export default router;

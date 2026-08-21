import { Router } from "express";
import {
  getAllProducts,
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./product.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";
import { parser } from "../../config/cloudinary";

const router = Router();

router.get("/", getAllProducts);
router.get("/mine", authMiddleware, authorize(UserRole.ARTISAN), getMyProducts);
router.post(
  "/",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  parser.single("image"),
  createProduct,
);
router.put(
  "/:id",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  parser.single("image"),
  updateProduct,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  deleteProduct,
);

export default router;

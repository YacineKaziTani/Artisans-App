import { Router } from "express";
import {
  getAllProducts,
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductImage,
  removeProductImage,
} from "./product.controller";
import {
  createVariantOption,
  deleteVariantOption,
  createVariantValue,
  deleteVariantValue,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
} from "./variant.controller";
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
  updateProduct,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  deleteProduct,
);
router.post(
  "/:id/images",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  parser.single("image"),
  addProductImage,
);
router.delete(
  "/images/:imageId",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  removeProductImage,
);

// ── Variant options/values/SKUs ─────────────────────────────────────────────
const artisanOrAdmin = authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN);

router.post("/:productId/variant-options", authMiddleware, artisanOrAdmin, createVariantOption);
router.delete("/variant-options/:id", authMiddleware, artisanOrAdmin, deleteVariantOption);

router.post("/variant-options/:optionId/values", authMiddleware, artisanOrAdmin, createVariantValue);
router.delete("/variant-values/:id", authMiddleware, artisanOrAdmin, deleteVariantValue);

router.post("/:productId/variants", authMiddleware, artisanOrAdmin, createProductVariant);
router.patch("/variants/:id", authMiddleware, artisanOrAdmin, updateProductVariant);
router.delete("/variants/:id", authMiddleware, artisanOrAdmin, deleteProductVariant);

export default router;

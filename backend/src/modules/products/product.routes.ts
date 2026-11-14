import { Router } from "express";
import {
  getAllProducts,
  getMyProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductImage,
  removeProductImage,
  getTrendingProducts,
  getSimilarProducts,
} from "./product.controller";
import { exportMyProducts, importMyProducts, recordProductView } from "./catalog.controller";
import express from "express";
import { optionalAuth } from "../../middleware/auth.middleware";
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
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import {
  createProductSchema,
  createProductVariantSchema,
  createVariantOptionSchema,
  createVariantValueSchema,
  updateProductSchema,
  updateProductVariantSchema,
} from "./product.schemas";

const router = Router();

router.param("id", uuidParam);
router.param("productId", uuidParam);
router.param("optionId", uuidParam);
router.param("imageId", uuidParam);

const artisanOrAdmin = authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN);

router.get("/", getAllProducts);
router.get("/mine", authMiddleware, authorize(UserRole.ARTISAN), getMyProducts);
router.get("/trending", getTrendingProducts);
router.get("/mine/export", authMiddleware, authorize(UserRole.ARTISAN), exportMyProducts);
router.post(
  "/mine/import",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  // The spreadsheet itself is the body (a few hundred rows can pass the
  // JSON parser's 100 KB default).
  express.text({ type: ["text/csv", "text/plain", "application/vnd.ms-excel"], limit: "1mb" }),
  importMyProducts,
);
router.post("/:id/view", optionalAuth, recordProductView);
router.get("/:id/similar", getSimilarProducts);
router.get("/:id", getProductById);
router.post(
  "/",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  parser.single("image"),
  validateBody(createProductSchema),
  createProduct,
);
router.put(
  "/:id",
  authMiddleware,
  artisanOrAdmin,
  validateBody(updateProductSchema),
  updateProduct,
);
router.delete("/:id", authMiddleware, artisanOrAdmin, deleteProduct);
router.post(
  "/:id/images",
  authMiddleware,
  artisanOrAdmin,
  parser.single("image"),
  addProductImage,
);
router.delete(
  "/images/:imageId",
  authMiddleware,
  artisanOrAdmin,
  removeProductImage,
);

// ── Variant options/values/SKUs ─────────────────────────────────────────────

router.post(
  "/:productId/variant-options",
  authMiddleware,
  artisanOrAdmin,
  validateBody(createVariantOptionSchema),
  createVariantOption,
);
router.delete(
  "/variant-options/:id",
  authMiddleware,
  artisanOrAdmin,
  deleteVariantOption,
);

router.post(
  "/variant-options/:optionId/values",
  authMiddleware,
  artisanOrAdmin,
  validateBody(createVariantValueSchema),
  createVariantValue,
);
router.delete(
  "/variant-values/:id",
  authMiddleware,
  artisanOrAdmin,
  deleteVariantValue,
);

router.post(
  "/:productId/variants",
  authMiddleware,
  artisanOrAdmin,
  validateBody(createProductVariantSchema),
  createProductVariant,
);
router.patch(
  "/variants/:id",
  authMiddleware,
  artisanOrAdmin,
  validateBody(updateProductVariantSchema),
  updateProductVariant,
);
router.delete(
  "/variants/:id",
  authMiddleware,
  artisanOrAdmin,
  deleteProductVariant,
);

export default router;

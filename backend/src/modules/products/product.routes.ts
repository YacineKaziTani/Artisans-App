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

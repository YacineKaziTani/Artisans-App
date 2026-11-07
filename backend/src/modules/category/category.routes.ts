import { Router } from "express";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategoriesAdmin,
} from "./category.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import {
  createCategorySchema,
  updateCategorySchema,
} from "./category.schemas";
import { auditAdmin } from "../audit/audit";

const router = Router();

router.param("id", uuidParam);

router.get("/", getCategories);
router.get(
  "/admin/all",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getAllCategoriesAdmin,
);
router.post(
  "/create",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(createCategorySchema),
  auditAdmin("category.created", "category"),
  createCategory,
);
router.put(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(updateCategorySchema),
  auditAdmin("category.updated", "category"),
  updateCategory,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  auditAdmin("category.deleted", "category"),
  deleteCategory,
);

export default router;

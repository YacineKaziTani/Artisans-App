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

const router = Router();

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
  createCategory,
);
router.put(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  updateCategory,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  deleteCategory,
);

export default router;

import { Router } from "express";
import { authorize } from "../../middleware/authorize.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { UserRole } from "./user.entities";
import { register, login } from "./authController";
import {
  getUsers,
  getMe,
  getUserById,
  updateMe,
  deleteUser,
} from "./user.controller";

const router = Router();

// Public auth routes
router.post("/register", register);
router.post("/login", login);

// Admin only
router.get("/", authMiddleware, authorize(UserRole.SUPER_ADMIN), getUsers);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  deleteUser,
);

// Authenticated user routes
router.get("/mine", authMiddleware, getMe);
router.patch("/mine", authMiddleware, updateMe);
router.get("/:id", getUserById);

export default router;

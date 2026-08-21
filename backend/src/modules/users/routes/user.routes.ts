import { Router } from "express";
import { authorize } from "../../../middleware/authorize.middleware";
import { authMiddleware } from "../../../middleware/auth.middleware";
import {
  getUsers,
  getMe,
  getUserById,
  updateMe,
  deleteUser,
  updateUserByAdmin,
} from "../controller/user.controller";
import { UserRole } from "../entities/user.entities";

const router = Router();

router.get("/", authMiddleware, authorize(UserRole.SUPER_ADMIN), getUsers);

router.get("/mine", authMiddleware, getMe);
router.patch("/mine", authMiddleware, updateMe);

router.patch(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  updateUserByAdmin,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  deleteUser,
);
router.get("/:id", getUserById);

export default router;

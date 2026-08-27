import { Router } from "express";
import { authorize } from "../../../middleware/authorize.middleware";
import { authLimiter } from "../../../middleware/rate-limit.middleware";
import { authMiddleware } from "../../../middleware/auth.middleware";
import {
  getUsers,
  getMe,
  getUserById,
  updateMe,
  changeMyPassword,
  deleteUser,
  updateUserByAdmin,
} from "../controller/user.controller";
import { UserRole } from "../entities/user.entities";
import { uuidParam } from "../../../middleware/validate.middleware";

const router = Router();

router.param("id", uuidParam);

router.get("/", authMiddleware, authorize(UserRole.SUPER_ADMIN), getUsers);

router.get("/mine", authMiddleware, getMe);
router.patch("/mine", authMiddleware, updateMe);
router.patch("/mine/password", authMiddleware, authLimiter, changeMyPassword);

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
router.get("/:id", authMiddleware, getUserById);

export default router;

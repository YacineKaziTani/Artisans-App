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
  uploadMyAvatar,
  getMyReferrals,
} from "../controller/user.controller";
import { getEmailStatus, sendTestEmail } from "../controller/admin-email.controller";
import { UserRole } from "../entities/user.entities";
import { parser } from "../../../config/cloudinary";
import {
  uuidParam,
  validateBody,
} from "../../../middleware/validate.middleware";
import {
  adminUpdateUserSchema,
  changePasswordSchema,
  updateMeSchema,
} from "../user.schemas";

const router = Router();

router.param("id", uuidParam);

router.get("/", authMiddleware, authorize(UserRole.SUPER_ADMIN), getUsers);

// Admin dashboard: check that emails actually reach people.
router.get(
  "/admin/email-status",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getEmailStatus,
);
router.post(
  "/admin/test-email",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  authLimiter,
  sendTestEmail,
);

router.get("/mine", authMiddleware, getMe);
router.get("/mine/referrals", authMiddleware, getMyReferrals);
router.patch("/mine", authMiddleware, validateBody(updateMeSchema), updateMe);
router.post(
  "/mine/avatar",
  authMiddleware,
  parser.single("image"),
  uploadMyAvatar,
);
router.patch(
  "/mine/password",
  authMiddleware,
  authLimiter,
  validateBody(changePasswordSchema),
  changeMyPassword,
);

router.patch(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(adminUpdateUserSchema),
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

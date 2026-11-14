import { Router } from "express";
import { z } from "zod";
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
  deleteMyAccount,
  exportMyData,
} from "../controller/user.controller";
import { getEmailStatus, sendTestEmail } from "../controller/admin-email.controller";
import { getMyQuickReplies, updateMyQuickReplies, MAX_QUICK_REPLIES } from "../controller/quick-replies.controller";
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
import { auditAdmin } from "../../audit/audit";

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
router.get("/mine/export", authMiddleware, exportMyData);
router.get("/mine/quick-replies", authMiddleware, getMyQuickReplies);
router.put(
  "/mine/quick-replies",
  authMiddleware,
  validateBody(
    z.object({
      replies: z
        .array(z.string({ error: "Replies must be text" }).trim().max(500, "Keep each reply under 500 characters"), {
          error: "replies must be a list",
        })
        .max(MAX_QUICK_REPLIES, `Save at most ${MAX_QUICK_REPLIES} replies`),
    }),
  ),
  updateMyQuickReplies,
);
// Before the /:id routes ("mine" isn't an id).
router.delete(
  "/mine",
  authMiddleware,
  authLimiter,
  validateBody(z.object({ password: z.string({ error: "Enter your password" }).min(1).max(128) })),
  deleteMyAccount,
);
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
  auditAdmin("user.updated", "user"),
  updateUserByAdmin,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  auditAdmin("user.deleted", "user"),
  deleteUser,
);
router.get("/:id", authMiddleware, getUserById);

export default router;

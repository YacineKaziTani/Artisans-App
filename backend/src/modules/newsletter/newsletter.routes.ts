import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { contactLimiter } from "../../middleware/rate-limit.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import { email } from "../../lib/schemas";
import { UserRole } from "../users/entities/user.entities";
import {
  confirmSubscription,
  exportSubscribers,
  getNewsletterStats,
  subscribe,
  unsubscribe,
} from "./newsletter.controller";

const tokenSchema = z.object({
  token: z.string({ error: "This link is invalid" }).regex(/^[0-9a-f]{64}$/i, "This link is invalid"),
});

const router = Router();

router.post("/subscribe", contactLimiter, validateBody(z.object({ email: email() })), subscribe);
router.post("/confirm", validateBody(tokenSchema), confirmSubscription);
router.post("/unsubscribe", validateBody(tokenSchema), unsubscribe);
router.get("/admin/stats", authMiddleware, authorize(UserRole.SUPER_ADMIN), getNewsletterStats);
router.get("/admin/export", authMiddleware, authorize(UserRole.SUPER_ADMIN), exportSubscribers);

export default router;

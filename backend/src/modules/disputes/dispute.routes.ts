import { Router } from "express";
import {
  createDispute,
  getMyDisputes,
  getAllDisputesAdmin,
  resolveDispute,
} from "./dispute.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { moderationLimiter } from "../../middleware/rate-limit.middleware";
import { UserRole } from "../users/entities/user.entities";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import { createDisputeSchema, resolveDisputeSchema } from "./dispute.schemas";

const router = Router();

router.param("id", uuidParam);

router.post(
  "/",
  authMiddleware,
  moderationLimiter,
  validateBody(createDisputeSchema),
  createDispute,
);
router.get("/mine", authMiddleware, getMyDisputes);
router.get(
  "/admin/all",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getAllDisputesAdmin,
);
router.patch(
  "/:id/resolve",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(resolveDisputeSchema),
  resolveDispute,
);

export default router;

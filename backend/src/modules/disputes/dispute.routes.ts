import { Router } from "express";
import {
  createDispute,
  getMyDisputes,
  getAllDisputesAdmin,
  resolveDispute,
} from "./dispute.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";

const router = Router();

router.post("/", authMiddleware, createDispute);
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
  resolveDispute,
);

export default router;

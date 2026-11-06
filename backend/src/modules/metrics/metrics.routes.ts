import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";
import { getAdminMetrics } from "./metrics.controller";

const router = Router();

router.get("/admin", authMiddleware, authorize(UserRole.SUPER_ADMIN), getAdminMetrics);

export default router;

import { Router } from "express";
import {
  createReport,
  getMyReports,
  getAllReportsAdmin,
  resolveReport,
} from "./report.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { moderationLimiter } from "../../middleware/rate-limit.middleware";
import { UserRole } from "../users/entities/user.entities";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import { createReportSchema, resolveReportSchema } from "./report.schemas";

const router = Router();

router.param("id", uuidParam);

router.post(
  "/",
  authMiddleware,
  moderationLimiter,
  validateBody(createReportSchema),
  createReport,
);
router.get("/mine", authMiddleware, getMyReports);
router.get(
  "/admin/all",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getAllReportsAdmin,
);
router.patch(
  "/:id",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(resolveReportSchema),
  resolveReport,
);

export default router;

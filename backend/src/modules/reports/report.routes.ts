import { Router } from "express";
import {
  createReport,
  getMyReports,
  getAllReportsAdmin,
  resolveReport,
} from "./report.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";

const router = Router();

router.post("/", authMiddleware, createReport);
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
  resolveReport,
);

export default router;

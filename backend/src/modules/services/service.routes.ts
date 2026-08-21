import { Router } from "express";
import {
  createService,
  getAllServices,
  updateService,
  deleteService,
} from "./service.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";

const router = Router();

router.get("/", getAllServices);
router.post("/create", authMiddleware, authorize(UserRole.ARTISAN), createService);
router.put(
  "/:id",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  updateService,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  deleteService,
);

export default router;

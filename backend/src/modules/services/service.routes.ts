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
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import { createServiceSchema, updateServiceSchema } from "./service.schemas";

const router = Router();

router.param("id", uuidParam);

router.get("/", getAllServices);
router.post(
  "/create",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  validateBody(createServiceSchema),
  createService,
);
router.put(
  "/:id",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  validateBody(updateServiceSchema),
  updateService,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  deleteService,
);

export default router;

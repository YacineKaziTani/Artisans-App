import { Router } from "express";
import {
  createService,
  getAllServices,
  updateService,
  deleteService,
} from "./service.controller";
import { getServiceAvailability } from "../booking/booking.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import { createServiceSchema, updateServiceSchema } from "./service.schemas";
import { auditAdmin } from "../audit/audit";

const router = Router();

router.param("id", uuidParam);

router.get("/", getAllServices);
// Free appointment times on a day, for shops with opening hours.
router.get("/:id/availability", getServiceAvailability);
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
  auditAdmin("service.updated", "service"),
  updateService,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN),
  auditAdmin("service.removed", "service"),
  deleteService,
);

export default router;

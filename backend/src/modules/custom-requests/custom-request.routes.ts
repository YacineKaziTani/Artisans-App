import { Router } from "express";
import { authMiddleware, requireVerifiedEmail } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { paymentLimiter } from "../../middleware/rate-limit.middleware";
import { UserRole } from "../users/entities/user.entities";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import { parser } from "../../config/cloudinary";
import {
  acceptCustomRequest,
  addCustomRequestPhoto,
  cancelCustomRequest,
  createCustomRequest,
  declineCustomRequest,
  getCustomRequest,
  getMyCustomRequests,
  getShopCustomRequests,
  quoteCustomRequest,
} from "./custom-request.controller";
import {
  acceptCustomRequestSchema,
  createCustomRequestSchema,
  declineCustomRequestSchema,
  quoteCustomRequestSchema,
} from "./custom-request.schemas";

const router = Router();
router.param("id", uuidParam);

router.post("/", authMiddleware, requireVerifiedEmail, validateBody(createCustomRequestSchema), createCustomRequest);
router.get("/mine", authMiddleware, getMyCustomRequests);
router.get("/shop", authMiddleware, authorize(UserRole.ARTISAN), getShopCustomRequests);
router.get("/:id", authMiddleware, getCustomRequest);
router.post("/:id/photos", authMiddleware, parser.single("image"), addCustomRequestPhoto);
router.patch("/:id/quote", authMiddleware, authorize(UserRole.ARTISAN), validateBody(quoteCustomRequestSchema), quoteCustomRequest);
router.patch("/:id/decline", authMiddleware, authorize(UserRole.ARTISAN), validateBody(declineCustomRequestSchema), declineCustomRequest);
router.patch("/:id/cancel", authMiddleware, cancelCustomRequest);
router.post(
  "/:id/accept",
  authMiddleware,
  requireVerifiedEmail,
  paymentLimiter,
  validateBody(acceptCustomRequestSchema),
  acceptCustomRequest,
);

export default router;

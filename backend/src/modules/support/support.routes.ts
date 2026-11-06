import { Router } from "express";
import { optionalAuth } from "../../middleware/auth.middleware";
import { contactLimiter } from "../../middleware/rate-limit.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import { contactSupport } from "./support.controller";
import { contactSchema } from "./support.schemas";

const router = Router();

router.post("/contact", contactLimiter, optionalAuth, validateBody(contactSchema), contactSupport);

export default router;

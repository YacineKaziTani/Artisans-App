import { Router } from "express";

import {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
} from "../controller/auth.controller";
import { authLimiter } from "../../../middleware/rate-limit.middleware";
import { authMiddleware } from "../../../middleware/auth.middleware";
import { validateBody } from "../../../middleware/validate.middleware";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../user.schemas";

const router = Router();

router.post("/register", authLimiter, validateBody(registerSchema), register);
router.post("/login", authLimiter, validateBody(loginSchema), login);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);
router.post(
  "/forgot-password",
  authLimiter,
  validateBody(forgotPasswordSchema),
  forgotPassword,
);
router.post(
  "/reset-password",
  authLimiter,
  validateBody(resetPasswordSchema),
  resetPassword,
);

export default router;

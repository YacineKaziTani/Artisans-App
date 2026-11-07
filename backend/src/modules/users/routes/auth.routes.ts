import { Router } from "express";

import {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendEmailVerification,
  logoutEverywhere,
  loginSecondStep,
  startTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
} from "../controller/auth.controller";
import { authLimiter } from "../../../middleware/rate-limit.middleware";
import { authMiddleware } from "../../../middleware/auth.middleware";
import { validateBody } from "../../../middleware/validate.middleware";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  loginSecondStepSchema,
  twoFactorCodeSchema,
  disableTwoFactorSchema,
} from "../user.schemas";

const router = Router();

router.post("/register", authLimiter, validateBody(registerSchema), register);
router.post("/login", authLimiter, validateBody(loginSchema), login);
router.post("/login/2fa", authLimiter, validateBody(loginSecondStepSchema), loginSecondStep);
router.post("/2fa/setup", authMiddleware, startTwoFactorSetup);
router.post("/2fa/enable", authMiddleware, authLimiter, validateBody(twoFactorCodeSchema), enableTwoFactor);
router.post("/2fa/disable", authMiddleware, authLimiter, validateBody(disableTwoFactorSchema), disableTwoFactor);
router.post("/logout", logout);
router.post("/logout-all", authMiddleware, logoutEverywhere);
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
router.post(
  "/verify-email",
  authLimiter,
  validateBody(verifyEmailSchema),
  verifyEmail,
);
router.post(
  "/resend-verification",
  authMiddleware,
  authLimiter,
  resendEmailVerification,
);

export default router;

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

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.get("/me", me);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);

export default router;

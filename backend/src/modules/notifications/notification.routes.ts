import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { uuidParam } from "../../middleware/validate.middleware";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.controller";

const router = Router();

router.param("id", uuidParam);

router.get("/", authMiddleware, getMyNotifications);
router.post("/read-all", authMiddleware, markAllNotificationsRead);
router.patch("/:id/read", authMiddleware, markNotificationRead);

export default router;

import { Router } from "express";
import {
  startConversation,
  getMyConversations,
  getConversationMessages,
  sendMessage,
  getAllConversationsAdmin,
  getConversationMessagesAdmin,
} from "./conversation.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";

const router = Router();

router.post("/", authMiddleware, startConversation);
router.get("/mine", authMiddleware, getMyConversations);

router.get(
  "/admin/all",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getAllConversationsAdmin,
);
router.get(
  "/admin/:id/messages",
  authMiddleware,
  authorize(UserRole.SUPER_ADMIN),
  getConversationMessagesAdmin,
);

router.get("/:id/messages", authMiddleware, getConversationMessages);
router.post("/:id/messages", authMiddleware, sendMessage);

export default router;

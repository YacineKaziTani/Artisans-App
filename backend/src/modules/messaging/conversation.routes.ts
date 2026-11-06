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
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import {
  sendMessageSchema,
  startConversationSchema,
} from "./conversation.schemas";

const router = Router();

router.param("id", uuidParam);

router.post(
  "/",
  authMiddleware,
  validateBody(startConversationSchema),
  startConversation,
);
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
router.post(
  "/:id/messages",
  authMiddleware,
  validateBody(sendMessageSchema),
  sendMessage,
);

export default router;

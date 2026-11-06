import { Request, Response } from "express";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Notification } from "./notification.entities";
import { pageResult, parsePagination } from "../../middleware/validate.middleware";

const notificationRepo = AppDataSource.getRepository(Notification);

/** GET /notifications — newest first, plus how many are unread. */
export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { page, take, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    const [[items, total], unread] = await Promise.all([
      notificationRepo.findAndCount({
        where: { user: { id: userId } },
        order: { createdAt: "DESC", id: "DESC" },
        skip,
        take,
      }),
      notificationRepo.count({ where: { user: { id: userId }, readAt: IsNull() } }),
    ]);
    return res.json({ ...pageResult(items, total, page, take), unread });
  } catch (error) {
    console.error("getMyNotifications failed:", error);
    return res.status(500).json({ message: "Couldn't load notifications" });
  }
};

/** PATCH /notifications/:id/read */
export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const result = await notificationRepo.update(
      { id: String(req.params.id), user: { id: req.user!.id }, readAt: IsNull() },
      { readAt: new Date() },
    );
    return res.json({ updated: result.affected ?? 0 });
  } catch (error) {
    console.error("markNotificationRead failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** POST /notifications/read-all */
export const markAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    const result = await notificationRepo.update(
      { user: { id: req.user!.id }, readAt: IsNull() },
      { readAt: new Date() },
    );
    return res.json({ updated: result.affected ?? 0 });
  } catch (error) {
    console.error("markAllNotificationsRead failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

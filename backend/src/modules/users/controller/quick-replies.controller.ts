import { Request, Response } from "express";
import { AppDataSource } from "../../../data-source";
import { User } from "../entities/user.entities";

const userRepo = AppDataSource.getRepository(User);

export const MAX_QUICK_REPLIES = 20;

/** GET /users/mine/quick-replies — saved chat answers. */
export const getMyQuickReplies = async (req: Request, res: Response) => {
  try {
    const user = await userRepo.findOne({
      where: { id: req.user!.id },
      select: { id: true, quickReplies: true },
    });
    return res.json({ replies: user?.quickReplies ?? [] });
  } catch (error) {
    console.error("getMyQuickReplies failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** PUT /users/mine/quick-replies { replies } — replaces the whole list. */
export const updateMyQuickReplies = async (req: Request, res: Response) => {
  try {
    const replies = (req.body as { replies: string[] }).replies;
    // Same text twice is one reply.
    const unique = [...new Set(replies.map((r) => r.trim()).filter(Boolean))];
    await userRepo.update(req.user!.id, { quickReplies: unique });
    return res.json({ replies: unique });
  } catch (error) {
    console.error("updateMyQuickReplies failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

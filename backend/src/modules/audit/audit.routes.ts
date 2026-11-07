import { Request, Response, Router } from "express";
import { AppDataSource } from "../../data-source";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { pageResult, parsePagination, queryString } from "../../middleware/validate.middleware";
import { UserRole } from "../users/entities/user.entities";
import { AdminAction } from "./admin-action.entities";

/** GET /audit — admin actions, newest first; ?targetType=shop narrows it. */
async function listAdminActions(req: Request, res: Response) {
  try {
    const { page, take, skip } = parsePagination(req.query, { defaultLimit: 25, maxLimit: 100 });
    const targetType = queryString(req.query.targetType);
    const [rows, total] = await AppDataSource.getRepository(AdminAction).findAndCount({
      where: targetType ? { targetType } : {},
      relations: ["admin"],
      select: { admin: { id: true, name: true } },
      order: { createdAt: "DESC", id: "DESC" },
      skip,
      take,
    });
    return res.json(pageResult(rows, total, page, take));
  } catch (error) {
    console.error("listAdminActions failed:", error);
    return res.status(500).json({ message: "Couldn't load the admin log" });
  }
}

const router = Router();
router.get("/", authMiddleware, authorize(UserRole.SUPER_ADMIN), listAdminActions);
export default router;

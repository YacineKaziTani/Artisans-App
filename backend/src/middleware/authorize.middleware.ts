import { Request, Response, NextFunction } from "express";
import { UserRole } from "../modules/users/entities/user.entities";

/**
 * Role gate. Runs after authMiddleware, which has already loaded the user
 * from the database for this request (so the role is current, not the one
 * baked into the token) — no need to query it a second time.
 */
export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden — you don't have permission for this action",
      });
    }
    next();
  };

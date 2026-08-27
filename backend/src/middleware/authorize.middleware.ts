import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../modules/users/entities/user.entities";

export const authorize = (...roles: UserRole[]) => {
  const userRepo = AppDataSource.getRepository(User);

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const current = await userRepo.findOne({ where: { id: req.user.id } });
    if (!current) {
      return res.status(401).json({ message: "Account no longer exists" });
    }
    if (!roles.includes(current.role)) {
      return res.status(403).json({
        message: "Forbidden — you don't have permission for this action",
      });
    }

    req.user.role = current.role;

    next();
  };
};

import { Request, Response, NextFunction } from "express";
import { UserRole } from "../modules/users/entities/user.entities";

// Usage: router.post("/", authenticate, authorize(UserRole.ARTISAN), controller)
// You can pass multiple roles: authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN)

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
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
};

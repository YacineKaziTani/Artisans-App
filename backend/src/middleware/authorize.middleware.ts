import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../modules/users/entities/user.entities";

// Usage: router.post("/", authenticate, authorize(UserRole.ARTISAN), controller)
// You can pass multiple roles: authorize(UserRole.ARTISAN, UserRole.SUPER_ADMIN)
//
// Roles and active-status are re-checked against the DB on every call rather
// than trusted from the JWT payload — otherwise a suspended user or one whose
// role just changed keeps their old permissions until their token expires.
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
    if (current.isActive === false) {
      return res.status(403).json({ message: "Account suspended" });
    }
    if (!roles.includes(current.role)) {
      return res.status(403).json({
        message: "Forbidden — you don't have permission for this action",
      });
    }

    // Keep req.user in sync with the DB in case role changed since the JWT
    // was issued, so downstream handlers see the current role too.
    req.user.role = current.role;

    next();
  };
};

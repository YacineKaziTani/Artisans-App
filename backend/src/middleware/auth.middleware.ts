import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../modules/users/entities/user.entities";

export interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  iat?: number;
  exp?: number;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined in .env");

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized no token provided",
    });
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }

  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: payload.sub },
      select: ["id", "name", "email", "role", "isActive", "passwordChangedAt"],
    });

    if (!user) {
      return res.status(401).json({ message: "Account no longer exists" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "Account suspended" });
    }
    if (
      user.passwordChangedAt &&
      payload.iat !== undefined &&
      payload.iat * 1000 < user.passwordChangedAt.getTime()
    ) {
      return res
        .status(401)
        .json({ message: "Session expired, please log in again" });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    next();
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};

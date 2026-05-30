import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined in .env");

export const authMiddleware = (
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

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

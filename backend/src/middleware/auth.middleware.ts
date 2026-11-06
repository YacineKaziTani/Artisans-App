import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../modules/users/entities/user.entities";
import { CLEAR_COOKIE_OPTIONS } from "../config/cookie";

export interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  iat?: number;
  exp?: number;
  role: UserRole;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined in .env");

export type SessionResult =
  | { ok: true; user: SessionUser }
  | { ok: false; status: 401 | 403; message: string };

/**
 * The single source of truth for "is this auth cookie still a valid
 * session?" — used by the HTTP middleware, /auth/me and the Socket.io
 * handshake, so all three agree. (They used to disagree: /auth/me skipped
 * the passwordChangedAt check, which sent the frontend into a redirect loop
 * after a password change on another device.)
 *
 * The role always comes from the database, never from the token, so a
 * demoted admin loses access immediately.
 *
 * Database errors are thrown, not returned — callers decide how to report
 * them.
 */
export async function resolveSession(
  token: string | undefined,
): Promise<SessionResult> {
  if (!token) {
    return { ok: false, status: 401, message: "Unauthorized no token provided" };
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET!) as JwtPayload;
  } catch (err) {
    return {
      ok: false,
      status: 401,
      message:
        err instanceof jwt.TokenExpiredError ? "Token expired" : "Invalid token",
    };
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: payload.sub },
    select: ["id", "name", "email", "role", "isActive", "passwordChangedAt"],
  });

  if (!user) {
    return { ok: false, status: 401, message: "Account no longer exists" };
  }
  if (!user.isActive) {
    return { ok: false, status: 403, message: "Account suspended" };
  }
  if (
    user.passwordChangedAt &&
    payload.iat !== undefined &&
    payload.iat * 1000 < user.passwordChangedAt.getTime()
  ) {
    return {
      ok: false,
      status: 401,
      message: "Session expired, please log in again",
    };
  }

  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await resolveSession(req.cookies.token);

    if (!session.ok) {
      // A dead session cookie is never going to work again — drop it so the
      // browser stops sending it (and the socket stops handshaking with it).
      if (session.status === 401 && req.cookies.token) {
        res.clearCookie("token", CLEAR_COOKIE_OPTIONS);
      }
      return res.status(session.status).json({ message: session.message });
    }

    req.user = session.user;
    next();
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};

import { Request, Response } from "express";
import { AppDataSource } from "../../../data-source";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../entities/user.entities";
import { sendMail } from "../../../config/mail";
import {
  COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS,
} from "../../../config/cookie";
import { disconnectUserSockets } from "../../../realtime/socket";
import { primaryFrontendUrl } from "../../../lib/urls";
import { isUniqueViolation } from "../../../lib/db";
import { escapeHtml } from "../../../lib/html";

// Request bodies are validated and normalized by the zod schemas in
// user.schemas.ts (emails arrive trimmed and lowercased).

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Compared against when the email doesn't exist, so a failed login takes
// about as long either way and response time doesn't reveal which emails
// have accounts.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", 12);

const userRepo = AppDataSource.getRepository(User);

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

function issueToken(user: User) {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

/**
 * Case-insensitive lookup. New accounts are stored lowercased, but older
 * ones may not be, and "User@x.com" and "user@x.com" must be one account.
 */
function byEmail(email: string, extraSelects: string[] = []) {
  return userRepo
    .createQueryBuilder("user")
    .addSelect(extraSelects.map((c) => `user.${c}`))
    .where("LOWER(user.email) = :email", { email: email.toLowerCase() });
}

export const register = async (req: Request, res: Response) => {
  try {
    const { email, name, password, phone, role } = req.body;

    const existingUser = await userRepo
      .createQueryBuilder("user")
      .where("LOWER(user.email) = :email", { email })
      .orWhere("user.phone = :phone", { phone })
      .getOne();
    if (existingUser) {
      const field =
        existingUser.email.toLowerCase() === email ? "Email" : "Phone number";
      return res.status(409).json({ message: `${field} already exists` });
    }

    const user = userRepo.create({
      name,
      email,
      phone,
      password: await bcrypt.hash(password, 12),
      role,
      acceptedTermsAt: new Date(),
    });

    try {
      await userRepo.save(user);
    } catch (err) {
      // Lost a race with a simultaneous sign-up for the same email/phone.
      if (isUniqueViolation(err)) {
        return res
          .status(409)
          .json({ message: "Email or phone number already exists" });
      }
      throw err;
    }

    res.cookie("token", issueToken(user), COOKIE_OPTIONS);
    res.status(201).json({
      message: "User created and logged in",
      user: publicUser(user),
    });
  } catch (err) {
    console.error("register failed:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await byEmail(email, [
      "password",
      "failedLoginAttempts",
      "lockedUntil",
    ]).getOne();

    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      return res.status(429).json({
        message: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
      });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        user.failedLoginAttempts = 0;
        await userRepo.save(user);
        return res.status(429).json({
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }
      await userRepo.save(user);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isActive === false) {
      return res
        .status(403)
        .json({ message: "This account has been suspended" });
    }

    if (user.failedLoginAttempts || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await userRepo.save(user);
    }

    res.cookie("token", issueToken(user), COOKIE_OPTIONS);
    res.json({ message: "Logged in successfully", user: publicUser(user) });
  } catch (error) {
    console.error("login failed:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie("token", CLEAR_COOKIE_OPTIONS);
  res.json({ message: "Logged out" });
};

// Mounted behind authMiddleware, so the session has already passed the same
// checks every other protected route applies (active account, not issued
// before the last password change).
export const me = async (req: Request, res: Response) => {
  try {
    const user = await userRepo.findOne({ where: { id: req.user!.id } });
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    res.json(publicUser(user));
  } catch (error) {
    console.error("me failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await byEmail(email).getOne();

    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordTokenHash = hashToken(rawToken);
      user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await userRepo.save(user);

      const resetUrl = `${primaryFrontendUrl()}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

      // Not awaited: sending takes long enough that awaiting it would let
      // response time reveal whether the email has an account.
      sendMail(
        user.email,
        "Reset your password",
        `<p>Hi ${escapeHtml(user.name)},</p>
         <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
         <p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
         <p>If you didn't request this, you can ignore this email.</p>`,
      ).catch((mailError) =>
        console.error("[forgot-password] Failed to send reset email:", mailError),
      );
    }

    return res.json({
      message: "If that email exists, a reset link has been sent",
    });
  } catch (error) {
    console.error("forgotPassword failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body;

    const user = await byEmail(email, [
      "resetPasswordTokenHash",
      "resetPasswordExpiresAt",
    ]).getOne();

    const tokenHash = hashToken(token);
    const valid =
      user?.resetPasswordTokenHash &&
      crypto.timingSafeEqual(
        Buffer.from(user.resetPasswordTokenHash),
        Buffer.from(tokenHash),
      ) &&
      user.resetPasswordExpiresAt &&
      user.resetPasswordExpiresAt.getTime() > Date.now();

    if (!user || !valid) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    // null, not undefined: save() skips undefined properties, so the old
    // code never actually cleared the token — the same reset link kept
    // working until it expired.
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await userRepo.save(user);
    disconnectUserSockets(user.id);

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("resetPassword failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

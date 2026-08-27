import { Request, Response } from "express";
import { AppDataSource } from "../../../data-source";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User, UserRole } from "../entities/user.entities";
import { sendMail } from "../../../config/mail";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_PASSWORD_LENGTH = 8;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const SELF_ASSIGNABLE_ROLES: UserRole[] = [UserRole.CLIENT, UserRole.ARTISAN];

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user: User) {
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

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
} as const;

export const register = async (req: Request, res: Response) => {
  try {
    const { email, name, password, phone, role, acceptTerms } = req.body;
    const userRepo = AppDataSource.getRepository(User);

    if (!email || !name || !password || !phone || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }
    if (!SELF_ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (acceptTerms !== true) {
      return res
        .status(400)
        .json({ message: "You must accept the Terms of Service to register" });
    }

    const existingUser = await userRepo.findOne({
      where: [{ email }, { phone }],
    });

    if (existingUser) {
      const field = existingUser.email === email ? "Email" : "Phone number";
      return res.status(400).json({ message: `${field} already exists` });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = userRepo.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      acceptedTermsAt: new Date(),
    });

    await userRepo.save(user);

    res.cookie("token", issueToken(user), COOKIE_OPTIONS);

    res.status(201).json({
      message: "User created and logged in",
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error during registration" });
  }
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo
      .createQueryBuilder("user")
      .addSelect([
        "user.password",
        "user.failedLoginAttempts",
        "user.lockedUntil",
      ])
      .where("user.email = :email", { email })
      .getOne();

    if (!user) {
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
      user.lockedUntil = undefined;
      await userRepo.save(user);
    }

    res.cookie("token", issueToken(user), COOKIE_OPTIONS);
    res.json({ message: "Logged in successfully", user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Server error during login" });
  }
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.json({ message: "Logged out" });
};

export const me = async (req: Request, res: Response) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
    };
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(publicUser(user));
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordTokenHash = hashToken(rawToken);
      user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await userRepo.save(user);

      const resetUrl = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

      try {
        await sendMail(
          user.email,
          "Reset your password",
          `<p>Hi ${user.name},</p>
           <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>If you didn't request this, you can ignore this email.</p>`,
        );
      } catch (mailError) {
        console.error(
          "[forgot-password] Failed to send reset email:",
          mailError,
        );
      }
    }

    return res.json({
      message: "If that email exists, a reset link has been sent",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res
        .status(400)
        .json({ message: "email, token, and newPassword are required" });
    }
    if (
      typeof newPassword !== "string" ||
      newPassword.length < MIN_PASSWORD_LENGTH
    ) {
      return res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo
      .createQueryBuilder("user")
      .addSelect(["user.resetPasswordTokenHash", "user.resetPasswordExpiresAt"])
      .where("user.email = :email", { email })
      .getOne();

    const tokenHash = hashToken(token);
    const valid =
      user?.resetPasswordTokenHash === tokenHash &&
      user?.resetPasswordExpiresAt &&
      user.resetPasswordExpiresAt.getTime() > Date.now();

    if (!user || !valid) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await userRepo.save(user);

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

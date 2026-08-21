import { Request, Response } from "express";
import { AppDataSource } from "../../../data-source";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../entities/user.entities";
import { sendMail } from "../../../config/mail";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const register = async (req: Request, res: Response) => {
  try {
    const { email, name, password, phone, role } = req.body;
    const userRepo = AppDataSource.getRepository(User);

    if (!email || !name || !password || !phone || !role) {
      return res.status(400).json({ message: "All fields are required" });
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
    });

    await userRepo.save(user);
    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, //in production we need to make this true
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: "User created and logged in",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error during registration" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: "This account has been suspended" });
    }
    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    //setting the cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // true in production HTTPS
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ message: "Logged in successfully" });
  } catch (error) {
    res.status(500).json({ message: "server error", error });
  }
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
};

export const me = (req: Request, res: Response) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    res.json(payload);
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Request a password reset email. Always responds the same way regardless
// of whether the email exists, so this can't be used to enumerate accounts.
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

      await sendMail(
        user.email,
        "Reset your password",
        `<p>Hi ${user.name},</p>
         <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
         <p><a href="${resetUrl}">${resetUrl}</a></p>
         <p>If you didn't request this, you can ignore this email.</p>`,
      );
    }

    return res.json({
      message: "If that email exists, a reset link has been sent",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Complete a password reset using the token emailed by forgotPassword.
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res
        .status(400)
        .json({ message: "email, token, and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const userRepo = AppDataSource.getRepository(User);
    // resetPasswordTokenHash/Expiry are select:false by default — fetch explicitly.
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
      return res
        .status(400)
        .json({ message: "Invalid or expired reset link" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    await userRepo.save(user);

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

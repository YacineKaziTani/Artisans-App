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
import { EMAIL_VERIFICATION_TTL_MS } from "../../../config/email-verification";
import { sendEmailVerification } from "../../../notifications";
import { notifyInBackground } from "../../../notifications/deliver";
import { newReferralCode } from "../../../lib/codes";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from "../../../lib/totp";

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
    emailVerified: Boolean(user.emailVerifiedAt),
    emailNotifications: user.emailNotifications !== false,
    twoFactorEnabled: Boolean(user.twoFactorEnabledAt),
    createdAt: user.createdAt,
  };
}

/** A fresh single-use confirmation token: the raw value for the email, the hash for the row. */
function newEmailVerificationToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  };
}

// The 2FA challenge is signed with a different key than sessions, so it
// can never be used as one.
const TWO_FACTOR_SECRET = `${process.env.JWT_SECRET}|2fa-challenge`;

function issueTwoFactorChallenge(userId: string) {
  return jwt.sign({ sub: userId, purpose: "2fa" }, TWO_FACTOR_SECRET, { expiresIn: "5m" });
}

/** Checks an authenticator code or an unused recovery code; consumes a recovery code. */
async function checkSecondFactor(userId: string, code: string): Promise<boolean> {
  const user = await userRepo
    .createQueryBuilder("user")
    .addSelect(["user.twoFactorSecret", "user.twoFactorRecoveryCodes"])
    .where("user.id = :id", { id: userId })
    .getOne();
  if (!user?.twoFactorSecret) return false;
  const trimmed = code.trim();
  if (/^\d{6}$/.test(trimmed)) return verifyTotp(user.twoFactorSecret, trimmed);

  const hash = hashRecoveryCode(trimmed);
  const remaining = user.twoFactorRecoveryCodes ?? [];
  if (!remaining.includes(hash)) return false;
  await userRepo.update(user.id, { twoFactorRecoveryCodes: remaining.filter((h) => h !== hash) });
  return true;
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
    const { email, name, password, phone, role, ref } = req.body;

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

    const referrer = ref ? await userRepo.findOne({ where: { referralCode: ref } }) : null;

    const verification = newEmailVerificationToken();
    const user = userRepo.create({
      name,
      email,
      phone,
      password: await bcrypt.hash(password, 12),
      role,
      acceptedTermsAt: new Date(),
      emailVerificationTokenHash: verification.hash,
      emailVerificationExpiresAt: verification.expiresAt,
      referralCode: newReferralCode(),
      referredBy: referrer ?? null,
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

    notifyInBackground(() => sendEmailVerification(user, verification.raw));

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

    // Two-step login: the password was right, now the authenticator code.
    // No session yet — just a short-lived challenge for /auth/login/2fa.
    if (user.twoFactorEnabledAt) {
      return res.json({ twoFactorRequired: true, challenge: issueTwoFactorChallenge(user.id) });
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
    // The reset link arrived in their inbox, which proves they own it.
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      user.emailVerificationTokenHash = null;
      user.emailVerificationExpiresAt = null;
    }
    await userRepo.save(user);
    disconnectUserSockets(user.id);

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("resetPassword failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * The link from the confirmation email. Public — it may be opened in a
 * browser where the user isn't signed in.
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token: string };
    const user = await userRepo
      .createQueryBuilder("user")
      .addSelect(["user.emailVerificationExpiresAt"])
      .where("user.emailVerificationTokenHash = :hash", { hash: hashToken(token) })
      .getOne();

    if (!user) {
      return res.status(400).json({
        message:
          "This link is invalid or has already been used. If your email isn't confirmed yet, sign in and send a new link.",
      });
    }
    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({
        message:
          "This link has expired. Sign in and send a new one from the banner at the top of the page.",
      });
    }

    user.emailVerifiedAt = user.emailVerifiedAt ?? new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await userRepo.save(user);
    // Open sockets were authorized as unverified — make them reconnect.
    disconnectUserSockets(user.id);

    return res.json({ message: "Email confirmed" });
  } catch (error) {
    console.error("verifyEmail failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** Sends a new confirmation link (the previous one stops working). */
export const resendEmailVerification = async (req: Request, res: Response) => {
  try {
    const user = await userRepo.findOne({ where: { id: req.user!.id } });
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if (user.emailVerifiedAt) {
      return res.json({ message: "Your email is already confirmed", alreadyVerified: true });
    }

    const verification = newEmailVerificationToken();
    await userRepo.update(user.id, {
      emailVerificationTokenHash: verification.hash,
      emailVerificationExpiresAt: verification.expiresAt,
    });
    notifyInBackground(() => sendEmailVerification(user, verification.raw));

    return res.json({ message: `We sent a new link to ${user.email}` });
  } catch (error) {
    console.error("resendEmailVerification failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /auth/logout-all — ends every session of this account (other
 * browsers, phones, a forgotten public computer), including this one.
 */
export const logoutEverywhere = async (req: Request, res: Response) => {
  try {
    await userRepo.update(req.user!.id, { sessionsRevokedAt: new Date() });
    disconnectUserSockets(req.user!.id);
    res.clearCookie("token", CLEAR_COOKIE_OPTIONS);
    return res.json({ message: "Signed out on all devices" });
  } catch (error) {
    console.error("logoutEverywhere failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── Two-step login ─────────────────────────────────────────────────────────

/** POST /auth/login/2fa { challenge, code } — finishes a two-step login. */
export const loginSecondStep = async (req: Request, res: Response) => {
  try {
    const { challenge, code } = req.body as { challenge: string; code: string };
    let userId: string;
    try {
      const payload = jwt.verify(challenge, TWO_FACTOR_SECRET) as { sub: string; purpose?: string };
      if (payload.purpose !== "2fa") throw new Error("wrong purpose");
      userId = payload.sub;
    } catch {
      return res.status(401).json({ message: "That took too long — please log in again." });
    }

    if (!(await checkSecondFactor(userId, code))) {
      return res.status(401).json({ message: "That code isn't right. Check your authenticator app and try again." });
    }
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user || user.isActive === false) {
      return res.status(403).json({ message: "This account can't sign in" });
    }
    res.cookie("token", issueToken(user), COOKIE_OPTIONS);
    return res.json({ message: "Logged in successfully", user: publicUser(user) });
  } catch (error) {
    console.error("loginSecondStep failed:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

/** POST /auth/2fa/setup — a new secret to add to an authenticator app (not active yet). */
export const startTwoFactorSetup = async (req: Request, res: Response) => {
  try {
    const user = await userRepo.findOne({ where: { id: req.user!.id } });
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if (user.twoFactorEnabledAt) {
      return res.status(400).json({ message: "Two-step login is already on" });
    }
    const secret = generateTotpSecret();
    await userRepo.update(user.id, { twoFactorPendingSecret: secret });
    return res.json({ secret, otpauthUrl: otpauthUrl(secret, user.email) });
  } catch (error) {
    console.error("startTwoFactorSetup failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** POST /auth/2fa/enable { code } — confirms the app works, turns it on, returns recovery codes once. */
export const enableTwoFactor = async (req: Request, res: Response) => {
  try {
    const user = await userRepo
      .createQueryBuilder("user")
      .addSelect(["user.twoFactorPendingSecret"])
      .where("user.id = :id", { id: req.user!.id })
      .getOne();
    if (!user?.twoFactorPendingSecret) {
      return res.status(400).json({ message: "Start the setup first" });
    }
    if (!verifyTotp(user.twoFactorPendingSecret, String(req.body.code ?? "").trim())) {
      return res.status(400).json({ message: "That code isn't right — check the time on your phone and try again.", field: "code" });
    }
    const { codes, hashes } = generateRecoveryCodes();
    await userRepo.update(user.id, {
      twoFactorSecret: user.twoFactorPendingSecret,
      twoFactorPendingSecret: null,
      twoFactorEnabledAt: new Date(),
      twoFactorRecoveryCodes: hashes,
    });
    return res.json({ message: "Two-step login is on", recoveryCodes: codes });
  } catch (error) {
    console.error("enableTwoFactor failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** POST /auth/2fa/disable { password, code } — needs both, so a stolen session alone can't turn it off. */
export const disableTwoFactor = async (req: Request, res: Response) => {
  try {
    const { password, code } = req.body as { password: string; code: string };
    const user = await userRepo
      .createQueryBuilder("user")
      .addSelect(["user.password"])
      .where("user.id = :id", { id: req.user!.id })
      .getOne();
    if (!user?.twoFactorEnabledAt) return res.status(400).json({ message: "Two-step login is already off" });
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Your password isn't right", field: "password" });
    }
    if (!(await checkSecondFactor(user.id, code))) {
      return res.status(400).json({ message: "That code isn't right", field: "code" });
    }
    await userRepo.update(user.id, {
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: null,
    });
    return res.json({ message: "Two-step login is off" });
  } catch (error) {
    console.error("disableTwoFactor failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

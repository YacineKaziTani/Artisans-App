import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { IsNull, Not } from "typeorm";
import { AppDataSource } from "../../../data-source";
import { User, UserRole } from "../entities/user.entities";
import { Shop, ShopStatus } from "../../shop/shop.entities";
import { Favorite } from "../../favorites/favorite.entities";
import { CLEAR_COOKIE_OPTIONS } from "../../../config/cookie";
import { disconnectUserSockets } from "../../../realtime/socket";
import { isUniqueViolation } from "../../../lib/db";
import { accountView } from "../user.views";
import { newReferralCode } from "../../../lib/codes";
import {
  pageResult,
  parsePagination,
  queryString,
} from "../../../middleware/validate.middleware";

// Request bodies are validated by the zod schemas in user.schemas.ts.

const userRepo = AppDataSource.getRepository(User);

const PROFILE_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  // accountView reports these — leaving them out made every account look
  // unconfirmed with activity emails on.
  emailVerifiedAt: true,
  emailNotifications: true,
  twoFactorEnabledAt: true,
  createdAt: true,
} as const;

/** Admin user list: paginated, searchable by name/email/phone, filterable by role. */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const search = queryString(req.query.search);
    const role = queryString(req.query.role) as UserRole | undefined;

    const qb = userRepo
      .createQueryBuilder("user")
      .select(Object.keys(PROFILE_FIELDS).map((field) => `user.${field}`))
      .where("user.deletedAt IS NULL");
    if (role && Object.values(UserRole).includes(role)) {
      qb.andWhere("user.role = :role", { role });
    }
    if (search) {
      qb.andWhere(
        "(user.name ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search)",
        { search: `%${search.replace(/[\\%_]/g, "\\$&")}%` },
      );
    }

    const [users, total] = await qb
      .orderBy("user.createdAt", "DESC")
      .addOrderBy("user.id", "ASC")
      .skip(skip)
      .take(take)
      .getManyAndCount();
    res.json(pageResult(users.map(accountView), total, page, take));
  } catch (error) {
    console.error("getUsers failed:", error);
    res.status(500).json({ message: "Server error fetching users" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const privileged =
      req.user?.id === id || req.user?.role === UserRole.SUPER_ADMIN;

    const user = await userRepo.findOne({
      where: { id },
      select: privileged
        ? PROFILE_FIELDS
        : { id: true, name: true, role: true, avatarUrl: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(privileged ? accountView(user) : user);
  } catch (error) {
    console.error("getUserById failed:", error);
    res.status(500).json({ message: "Server error fetching user" });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await userRepo.findOne({
      where: { id: req.user!.id },
      select: PROFILE_FIELDS,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(accountView(user));
  } catch (error) {
    console.error("getMe failed:", error);
    res.status(500).json({ message: "Server error fetching profile" });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, phone, avatarUrl, emailNotifications } = req.body as {
      name?: string;
      phone?: string;
      avatarUrl?: string | null;
      emailNotifications?: boolean;
    };

    if (phone !== undefined) {
      const taken = await userRepo.exists({
        where: { phone, id: Not(userId) },
      });
      if (taken) {
        return res
          .status(409)
          .json({ message: "That phone number is already in use" });
      }
    }

    const changes: Partial<User> = {};
    if (name !== undefined) changes.name = name;
    if (phone !== undefined) changes.phone = phone;
    if (avatarUrl !== undefined) changes.avatarUrl = avatarUrl;
    if (emailNotifications !== undefined) changes.emailNotifications = emailNotifications;

    try {
      if (Object.keys(changes).length) await userRepo.update(userId, changes);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res
          .status(409)
          .json({ message: "That phone number is already in use" });
      }
      throw err;
    }

    const fresh = await userRepo.findOne({ where: { id: userId }, select: PROFILE_FIELDS });
    res.json(fresh && accountView(fresh));
  } catch (error) {
    console.error("updateMe failed:", error);
    res.status(500).json({ message: "Server error updating profile" });
  }
};

export const changeMyPassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await userRepo
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.id = :id", { id: req.user!.id })
      .getOne();
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res
        .status(401)
        .json({ message: "Current password is incorrect", field: "currentPassword" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await userRepo.save(user);
    disconnectUserSockets(user.id);

    res.clearCookie("token", CLEAR_COOKIE_OPTIONS);
    res.json({ message: "Password changed — please log in again" });
  } catch (error) {
    console.error("changeMyPassword failed:", error);
    res.status(500).json({ message: "Server error changing password" });
  }
};

/**
 * Admin "delete": the account is anonymized and deactivated rather than
 * removed. A hard delete failed with a foreign-key error for anyone who had
 * ever ordered, booked, reviewed or messaged — and would have torn holes in
 * other people's order history if it had worked. Their shop is closed.
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (id === req.user!.id) {
      return res
        .status(400)
        .json({ message: "You can't delete your own account here" });
    }

    const user = await userRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === UserRole.SUPER_ADMIN) {
      const admins = await userRepo.count({
        where: { role: UserRole.SUPER_ADMIN, deletedAt: IsNull() },
      });
      if (admins <= 1) {
        return res.status(400).json({
          message: "This is the only admin account — promote another one first",
        });
      }
    }

    await anonymizeAccount(user);
    res.status(204).send();
  } catch (error) {
    console.error("deleteUser failed:", error);
    res.status(500).json({ message: "Server error deleting user" });
  }
};

export const updateUserByAdmin = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { role, isActive } = req.body as {
      role?: UserRole;
      isActive?: boolean;
    };

    if (id === req.user!.id && (role !== undefined || isActive === false)) {
      return res.status(400).json({
        message: "You can't change your own role or suspend yourself",
      });
    }

    const user = await userRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      user.role === UserRole.SUPER_ADMIN &&
      (role !== undefined && role !== UserRole.SUPER_ADMIN || isActive === false)
    ) {
      const admins = await userRepo.count({
        where: { role: UserRole.SUPER_ADMIN, isActive: true, deletedAt: IsNull() },
      });
      if (admins <= 1) {
        return res.status(400).json({
          message: "This is the only active admin — promote another one first",
        });
      }
    }

    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    await userRepo.save(user);

    // Live sockets were authorized with the old role/status — drop them.
    disconnectUserSockets(id);

    const fresh = await userRepo.findOne({ where: { id }, select: PROFILE_FIELDS });
    res.json(fresh && accountView(fresh));
  } catch (error) {
    console.error("updateUserByAdmin failed:", error);
    res.status(500).json({ message: "Server error updating user" });
  }
};

/** Upload a new profile photo (multipart "image", via the Cloudinary parser). */
export const uploadMyAvatar = async (req: Request, res: Response) => {
  try {
    const url = req.file?.path;
    if (!url) return res.status(400).json({ message: "No image file provided" });
    await userRepo.update(req.user!.id, { avatarUrl: url });
    const fresh = await userRepo.findOne({
      where: { id: req.user!.id },
      select: PROFILE_FIELDS,
    });
    res.json(fresh && accountView(fresh));
  } catch (error) {
    console.error("uploadMyAvatar failed:", error);
    res.status(500).json({ message: "Couldn't update your photo" });
  }
};

/**
 * GET /users/mine/referrals — the user's invite code and how many people
 * signed up with it (accounts made before invite codes get one now).
 */
export const getMyReferrals = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await userRepo.findOne({ where: { id: userId }, select: { id: true, referralCode: true } });
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    let code = user.referralCode;
    if (!code) {
      code = newReferralCode();
      await userRepo.update(userId, { referralCode: code });
    }
    const [joined, artisans] = await Promise.all([
      userRepo.count({ where: { referredBy: { id: userId } } }),
      userRepo.count({ where: { referredBy: { id: userId }, role: UserRole.ARTISAN } }),
    ]);
    return res.json({ code, joined, artisans });
  } catch (error) {
    console.error("getMyReferrals failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── Account deletion & data export (self-service) ──────────────────────────

/**
 * Erases an account's personal data while keeping the row, so orders,
 * bookings, reviews and messages that reference it stay consistent for the
 * other side. Used by admins and by people deleting their own account.
 */
export async function anonymizeAccount(user: User) {
  const id = user.id;
  const now = new Date();
  // An unguessable password nobody knows, so the row can never sign in
  // even if it were reactivated by mistake.
  const lockedPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

  await AppDataSource.transaction(async (manager) => {
    await manager.update(User, id, {
      name: "Deleted user",
      email: `deleted-${id}@deleted.invalid`,
      phone: `deleted-${id}`,
      avatarUrl: null,
      password: lockedPassword,
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: null,
      referralCode: null,
      emailNotifications: false,
      isActive: false,
      passwordChangedAt: now,
      sessionsRevokedAt: now,
      deletedAt: now,
    });

    const shop = await manager.findOne(Shop, { where: { owner: { id } } });
    if (shop) {
      await manager.update(Shop, shop.id, { status: ShopStatus.CLOSED, phone: null, address: null });
    }

    await manager.createQueryBuilder().delete().from(Favorite).where(`"userId" = :id`, { id }).execute();
    await manager.query(`DELETE FROM notifications WHERE "userId" = $1`, [id]);
    await manager.query(`DELETE FROM newsletter_subscribers WHERE email = $1`, [user.email.toLowerCase()]);
  });

  disconnectUserSockets(id);
}

/** Why an account can't be deleted right now (things in progress), or null. */
async function deletionBlocker(user: User): Promise<string | null> {
  if (user.role === UserRole.SUPER_ADMIN) {
    const admins = await userRepo.count({ where: { role: UserRole.SUPER_ADMIN, deletedAt: IsNull() } });
    if (admins <= 1) return "You're the only admin — make someone else an admin first.";
  }
  const [[asClient], [asShop]] = await Promise.all([
    AppDataSource.query(
      `SELECT
         (SELECT COUNT(*)::int FROM orders WHERE "clientId" = $1 AND status = 'pending'
            AND "paymentStatus" IN ('authorized', 'paid')) AS orders,
         (SELECT COUNT(*)::int FROM bookings WHERE "clientId" = $1 AND status IN ('pending', 'confirmed')
            AND "scheduledAt" > now() AND "paymentStatus" IN ('authorized', 'paid')) AS bookings`,
      [user.id],
    ),
    AppDataSource.query(
      `SELECT
         (SELECT COUNT(*)::int FROM orders o JOIN shops s ON s.id = o."shopId"
           WHERE s."ownerId" = $1 AND o.status = 'pending' AND o."paymentStatus" IN ('authorized', 'paid')) AS orders,
         (SELECT COUNT(*)::int FROM bookings b JOIN shops s ON s.id = b."shopId"
           WHERE s."ownerId" = $1 AND b.status IN ('pending', 'confirmed') AND b."scheduledAt" > now()
             AND b."paymentStatus" IN ('authorized', 'paid')) AS bookings`,
      [user.id],
    ),
  ]);
  if (asClient.orders || asClient.bookings) {
    return "You have orders or bookings in progress — cancel them or wait until they're done, then delete your account.";
  }
  if (asShop.orders || asShop.bookings) {
    return "Your shop has orders or bookings to fulfil — complete or cancel them first, then delete your account.";
  }
  return null;
}

/** DELETE /users/mine { password } — the user deletes their own account. */
export const deleteMyAccount = async (req: Request, res: Response) => {
  try {
    const user = await userRepo
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.id = :id AND user.deletedAt IS NULL", { id: req.user!.id })
      .getOne();
    if (!user) return res.status(404).json({ message: "Account not found" });
    if (!(await bcrypt.compare(String(req.body.password ?? ""), user.password))) {
      return res.status(400).json({ message: "That password isn't right", field: "password" });
    }
    const blocker = await deletionBlocker(user);
    if (blocker) return res.status(409).json({ message: blocker });

    await anonymizeAccount(user);
    res.clearCookie("token", CLEAR_COOKIE_OPTIONS);
    return res.json({ message: "Your account has been deleted" });
  } catch (error) {
    console.error("deleteMyAccount failed:", error);
    return res.status(500).json({ message: "Server error deleting your account" });
  }
};

/**
 * GET /users/mine/export — everything the platform holds about this
 * account, as a JSON download (right of access / data portability).
 */
export const exportMyData = async (req: Request, res: Response) => {
  try {
    const id = req.user!.id;
    const user = await userRepo.findOne({ where: { id } });
    if (!user) return res.status(404).json({ message: "Account not found" });
    const q = (sql: string, params: unknown[] = [id]) => AppDataSource.query(sql, params);

    const [shop, orders, bookings, reviews, messages, favorites, notifications, disputes, reports, newsletter, referrals, customRequests] =
      await Promise.all([
        q(`SELECT id, "shopName", description, address, city, phone, status, timezone, "openingHours",
                  "createdAt" FROM shops WHERE "ownerId" = $1`),
        q(`SELECT o.id, COALESCE(p.title, o.title) AS product, o."variantLabel", o.quantity, o."totalAmount",
                  o."deliveryFee", o."discountCode", o."discountAmount", o.status, o."paymentStatus", o."deliveryMethod", o."shippingAddress", o."createdAt", s."shopName" AS shop
             FROM orders o LEFT JOIN products p ON p.id = o."productId" JOIN shops s ON s.id = o."shopId"
            WHERE o."clientId" = $1 ORDER BY o."createdAt"`),
        q(`SELECT b.id, sv.name AS service, b."scheduledAt", b.notes, b.status, b."paymentStatus", b."totalAmount",
                  b."createdAt", s."shopName" AS shop
             FROM bookings b LEFT JOIN services sv ON sv.id = b."serviceId" JOIN shops s ON s.id = b."shopId"
            WHERE b."clientId" = $1 ORDER BY b."createdAt"`),
        q(`SELECT r.id, r.rating, r.comment, r.reply, r."createdAt", s."shopName" AS shop
             FROM reviews r JOIN shops s ON s.id = r."shopId" WHERE r."authorId" = $1 ORDER BY r."createdAt"`),
        q(`SELECT id, "conversationId", content, attachments, "createdAt", "readAt" FROM messages WHERE "senderId" = $1 ORDER BY "createdAt"`),
        q(`SELECT "targetType", "targetId", "createdAt" FROM favorites WHERE "userId" = $1`),
        q(`SELECT title, body, "createdAt", "readAt" FROM notifications WHERE "userId" = $1 ORDER BY "createdAt"`),
        q(`SELECT id, "targetType", "targetId", reason, status, "resolutionNote", "createdAt" FROM disputes WHERE "raisedById" = $1`),
        q(`SELECT id, "targetType", "targetId", reason, status, "createdAt" FROM reports WHERE "reporterId" = $1`),
        q(`SELECT "confirmedAt", "unsubscribedAt", "createdAt" FROM newsletter_subscribers WHERE email = $1`, [user.email.toLowerCase()]),
        q(`SELECT COUNT(*)::int AS joined FROM users WHERE "referredById" = $1`),
        q(`SELECT r.id, s."shopName" AS shop, r.description, r.budget, r."neededBy", r.status, r."quotePrice",
                  r."quoteReadyBy", r."quoteNote", r."createdAt"
             FROM custom_requests r JOIN shops s ON s.id = r."shopId" WHERE r."clientId" = $1 ORDER BY r."createdAt"`),
      ]);

    const data = {
      exportedAt: new Date().toISOString(),
      account: {
        ...accountView(user),
        acceptedTermsAt: user.acceptedTermsAt ?? null,
        referralCode: user.referralCode ?? null,
        peopleReferred: referrals[0]?.joined ?? 0,
      },
      shop: shop[0] ?? null,
      orders,
      bookings,
      customRequests,
      reviews,
      messagesSent: messages,
      favorites,
      notifications,
      disputes,
      reports,
      newsletter: newsletter[0] ?? null,
    };
    res.set("Content-Type", "application/json; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="artisan-market-data-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("exportMyData failed:", error);
    return res.status(500).json({ message: "Couldn't prepare your data" });
  }
};

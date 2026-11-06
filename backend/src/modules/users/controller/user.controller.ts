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

    const now = new Date();
    // An unguessable password nobody knows, so the row can never sign in
    // even if it were reactivated by mistake.
    const lockedPassword = await bcrypt.hash(
      crypto.randomBytes(32).toString("hex"),
      10,
    );

    await AppDataSource.transaction(async (manager) => {
      await manager.update(User, id, {
        name: "Deleted user",
        email: `deleted-${id}@deleted.invalid`,
        phone: `deleted-${id}`,
        avatarUrl: null,
        password: lockedPassword,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
        isActive: false,
        passwordChangedAt: now,
        deletedAt: now,
      });

      const shop = await manager.findOne(Shop, { where: { owner: { id } } });
      if (shop) {
        await manager.update(Shop, shop.id, { status: ShopStatus.CLOSED });
      }

      await manager
        .createQueryBuilder()
        .delete()
        .from(Favorite)
        .where(`"userId" = :id`, { id })
        .execute();
    });

    disconnectUserSockets(id);
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

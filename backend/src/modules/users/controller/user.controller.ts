import { Request, Response } from "express";
import { AppDataSource } from "../../../data-source";
import bcrypt from "bcrypt";
import { User, UserRole } from "../entities/user.entities";
import { CLEAR_COOKIE_OPTIONS } from "../../../config/cookie";

const MIN_PASSWORD_LENGTH = 8;

const userRepo = AppDataSource.getRepository(User);

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await userRepo.find({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching users" });
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
        ? {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            avatarUrl: true,
            createdAt: true,
          }
        : {
            id: true,
            name: true,
            role: true,
            avatarUrl: true,
            createdAt: true,
          },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching user" });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userReq = req as any;
    if (!userReq.user)
      return res.status(401).json({ error: "Not authenticated" });

    const user = await userRepo.findOne({
      where: { id: userReq.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching profile" });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    const userReq = req as any;
    if (!userReq.user)
      return res.status(401).json({ error: "Not authenticated" });

    const user = await userRepo.findOneBy({ id: userReq.user.id });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { name, phone, avatarUrl } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Name can't be empty" });
      }
      user.name = name.trim();
    }
    if (phone !== undefined) {
      if (typeof phone !== "string" || !phone.trim()) {
        return res.status(400).json({ error: "Phone can't be empty" });
      }
      const taken = await userRepo.findOne({ where: { phone: phone.trim() } });
      if (taken && taken.id !== user.id) {
        return res
          .status(409)
          .json({ error: "That phone number is already in use" });
      }
      user.phone = phone.trim();
    }
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    const updatedUser = await userRepo.save(user);

    const { password, ...userData } = updatedUser;
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: "Server error updating profile" });
  }
};

export const changeMyPassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "currentPassword and newPassword are required" });
    }
    if (
      typeof newPassword !== "string" ||
      newPassword.length < MIN_PASSWORD_LENGTH
    ) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const user = await userRepo
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.id = :id", { id: req.user!.id })
      .getOne();
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await userRepo.save(user);

    res.clearCookie("token", CLEAR_COOKIE_OPTIONS);
    res.json({ message: "Password changed — please log in again" });
  } catch (error) {
    res.status(500).json({ error: "Server error changing password" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (id === req.user?.id) {
      return res
        .status(400)
        .json({ error: "You can't delete your own account here" });
    }

    const user = await userRepo.findOneBy({ id });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === UserRole.SUPER_ADMIN) {
      const admins = await userRepo.count({
        where: { role: UserRole.SUPER_ADMIN },
      });
      if (admins <= 1) {
        return res
          .status(400)
          .json({
            error: "This is the only admin account — promote another one first",
          });
      }
    }

    await userRepo.remove(user);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Server error deleting user" });
  }
};

export const updateUserByAdmin = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { role, isActive } = req.body;

    if (id === req.user?.id && (role !== undefined || isActive === false)) {
      return res.status(400).json({
        error: "You can't change your own role or suspend yourself",
      });
    }
    if (role !== undefined && !Object.values(UserRole).includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await userRepo.findOneBy({ id });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    const updated = await userRepo.save(user);
    const { password, ...userData } = updated;
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: "Server error updating user" });
  }
};

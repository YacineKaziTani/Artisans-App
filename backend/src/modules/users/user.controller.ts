import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { User } from "./entities/user.entities";
const userRepo = AppDataSource.getRepository(User);

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await userRepo.find({
      select: [
        "id",
        "name",
        "email",
        "phone",
        "role",
        "isActive",
        "avatarUrl",
        "createdAt",
      ],
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching users" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await userRepo.findOne({
      where: { id: req.params.id },
      select: [
        "id",
        "name",
        "email",
        "phone",
        "role",
        "isActive",
        "avatarUrl",
        "createdAt",
      ],
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

    // Using 'sub' as defined in authController.ts JWT payload
    const user = await userRepo.findOneBy({ id: userReq.user.sub });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { password, ...userData } = user;
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching profile" });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    const userReq = req as any;
    if (!userReq.user)
      return res.status(401).json({ error: "Not authenticated" });

    const user = await userRepo.findOneBy({ id: userReq.user.sub });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { name, phone, avatarUrl } = req.body;

    userRepo.merge(user, { name, phone, avatarUrl });
    const updatedUser = await userRepo.save(user);

    const { password, ...userData } = updatedUser;
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: "Server error updating profile" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await userRepo.findOneBy({ id: req.params.id });
    if (!user) return res.status(404).json({ error: "User not found" });

    await userRepo.remove(user);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Server error deleting user" });
  }
};

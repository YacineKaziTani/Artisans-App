import { Request, Response } from "express";
import { AppDataSource } from "../../../data-source";
import { User } from "../entities/user.entities";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body;
    const userRepo = AppDataSource.getRepository(User);

    if (!email || !name || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await userRepo.findOneBy({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = userRepo.create({
      name,
      email,
      password: hashedPassword,
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

    res.status(201).json({ message: "User created and logged in" });
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
    res.status(500).json({ error: "server error" });
  }
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
};

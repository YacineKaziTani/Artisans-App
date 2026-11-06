import { Request, Response } from "express";

import { AppDataSource } from "../../data-source";
import { Category } from "./category.entities";
import { Shop } from "../shop/shop.entities";
import { isUniqueViolation } from "../../lib/db";

// Request bodies are validated by the zod schemas in category.schemas.ts.

const categoryRepo = AppDataSource.getRepository(Category);
const shopRepo = AppDataSource.getRepository(Shop);

const DUPLICATE_NAME = { message: "A category with that name already exists" };

export const getCategories = async (req: Request, res: Response) => {
  try {
    const category = await categoryRepo.find({
      where: { isActive: true },
      order: { name: "ASC" },
    });
    res.json({ msg: "request success", category });
  } catch (error) {
    console.error("getCategories failed:", error);
    res.status(500).json({ message: "Error fetching categories" });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, iconUrl } = req.body;
    const newCategory = categoryRepo.create({
      name,
      description: description || undefined,
      iconUrl,
    });
    try {
      await categoryRepo.save(newCategory);
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json(DUPLICATE_NAME);
      throw err;
    }
    res
      .status(201)
      .json({ message: "category created successfully", data: newCategory });
  } catch (error) {
    console.error("createCategory failed:", error);
    res.status(500).json({ message: "Error creating category" });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, description, iconUrl, isActive } = req.body;

    const category = await categoryRepo.findOne({ where: { id } });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (iconUrl !== undefined) category.iconUrl = iconUrl;
    if (isActive !== undefined) category.isActive = isActive;

    try {
      const saved = await categoryRepo.save(category);
      res.json({ message: "category updated", data: saved });
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json(DUPLICATE_NAME);
      throw err;
    }
  } catch (error) {
    console.error("updateCategory failed:", error);
    res.status(500).json({ message: "Error updating category" });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const category = await categoryRepo.findOne({ where: { id } });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Shops reference their category, so deleting one in use used to fail
    // with a foreign-key error (a bare 500 in the admin panel).
    const inUse = await shopRepo.count({ where: { category: { id } } });
    if (inUse > 0) {
      return res.status(409).json({
        message: `${inUse} shop${inUse === 1 ? " uses" : "s use"} this category — deactivate it instead to hide it from new shops`,
      });
    }

    await categoryRepo.remove(category);
    res.status(204).send();
  } catch (error) {
    console.error("deleteCategory failed:", error);
    res.status(500).json({ message: "Error deleting category" });
  }
};

export const getAllCategoriesAdmin = async (req: Request, res: Response) => {
  try {
    const categories = await categoryRepo.find({
      order: { createdAt: "DESC" },
    });
    res.json(categories);
  } catch (error) {
    console.error("getAllCategoriesAdmin failed:", error);
    res.status(500).json({ message: "Error fetching categories" });
  }
};

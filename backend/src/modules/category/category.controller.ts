import { Request, Response } from "express";

import { AppDataSource } from "../../data-source";
import { Category } from "./category.entities";

const categoryRepo = AppDataSource.getRepository(Category);

// Fetch all active categories (public)
export const getCategories = async (req: Request, res: Response) => {
  try {
    const category = await categoryRepo.find({ where: { isActive: true } });
    res.json({ msg: "request success", category });
  } catch (error) {
    res.status(500).json({ message: "Error fetching categories", error });
  }
};

// Create a new category (super_admin only)
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, iconUrl } = req.body;
    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const newCategory = categoryRepo.create({ name, description, iconUrl });
    await categoryRepo.save(newCategory);
    res
      .status(201)
      .json({ message: "category created successfully", data: newCategory });
  } catch (error) {
    res.status(500).json({ message: "Error creating category", error });
  }
};

// Update a category (super_admin only)
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

    const saved = await categoryRepo.save(category);
    res.json({ message: "category updated", data: saved });
  } catch (error) {
    res.status(500).json({ message: "Error updating category", error });
  }
};

// Delete a category (super_admin only)
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const category = await categoryRepo.findOne({ where: { id } });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    await categoryRepo.remove(category);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Error deleting category", error });
  }
};

// All categories regardless of isActive (super_admin only, for the dashboard)
export const getAllCategoriesAdmin = async (req: Request, res: Response) => {
  try {
    const categories = await categoryRepo.find({
      order: { createdAt: "DESC" },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Error fetching categories", error });
  }
};

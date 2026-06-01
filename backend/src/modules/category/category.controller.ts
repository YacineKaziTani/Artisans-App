import { Request, Response } from "express";

import { AppDataSource } from "../../data-source";
import { Category } from "./category.entities";

//request All Categories
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categoryRepo = AppDataSource.getRepository(Category);
    const category = await categoryRepo.find();
    res.json({ msg: "request succes", category });
  } catch (error) {
    res.status(500).json({ message: "Error fetching categories" });
  }
};

//Create a new category
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const categoryRepo = AppDataSource.getRepository(Category);
    // creating an object before saving to FB
    const newCategory = categoryRepo.create({ name });
    // save() poushes it to Postges
    await categoryRepo.save(newCategory);
    res
      .status(201)
      .json({ message: "category created successfully", data: newCategory });
  } catch (error) {
    res.status(500).json({ messge: "Error creating category" });
  }
};

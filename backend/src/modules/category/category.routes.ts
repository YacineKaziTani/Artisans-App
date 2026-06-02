import { Router } from "express";
import { getCategories, createCategory } from "./category.controller";

const router = Router();
router.get("/", getCategories);
router.post("/create", createCategory);
export default router;

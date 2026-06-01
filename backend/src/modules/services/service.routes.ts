import Router from "express";
import { createService, getAllServices } from "./service.controller";

const router = Router();
router.post("/", createService);
router.get("/", getAllServices);
export default router;

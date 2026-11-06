import { Router } from "express";
import { getSitemapData } from "./seo.controller";

const router = Router();

router.get("/sitemap", getSitemapData);

export default router;

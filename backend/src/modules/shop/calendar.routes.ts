import { Router } from "express";
import { getCalendarFeed } from "./shop-tools.controller";

// Public (calendar apps can't sign in) — the secret token in the URL is the key.
const router = Router();
router.get("/:token.ics", getCalendarFeed);

export default router;

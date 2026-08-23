import { Router } from "express";
import { toggleFavorite, getMyFavoriteIds, getMyFavorites } from "./favorite.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.post("/toggle", authMiddleware, toggleFavorite);
router.get("/mine/ids", authMiddleware, getMyFavoriteIds);
router.get("/mine", authMiddleware, getMyFavorites);

export default router;

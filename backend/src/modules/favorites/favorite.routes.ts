import { Router } from "express";
import { toggleFavorite, getMyFavoriteIds, getMyFavorites } from "./favorite.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import { toggleFavoriteSchema } from "./favorite.schemas";

const router = Router();

router.post(
  "/toggle",
  authMiddleware,
  validateBody(toggleFavoriteSchema),
  toggleFavorite,
);
router.get("/mine/ids", authMiddleware, getMyFavoriteIds);
router.get("/mine", authMiddleware, getMyFavorites);

export default router;

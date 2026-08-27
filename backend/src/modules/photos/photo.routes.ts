import { Router } from "express";
import { uploadPhoto, getMyPhotos, deletePhoto } from "./photo.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";
import { parser } from "../../config/cloudinary";
import { uuidParam } from "../../middleware/validate.middleware";

const router = Router();

router.param("id", uuidParam);

router.get("/mine", authMiddleware, authorize(UserRole.ARTISAN), getMyPhotos);
router.post(
  "/",
  authMiddleware,
  authorize(UserRole.ARTISAN),
  parser.single("image"),
  uploadPhoto,
);
router.delete("/:id", authMiddleware, authorize(UserRole.ARTISAN), deletePhoto);

export default router;

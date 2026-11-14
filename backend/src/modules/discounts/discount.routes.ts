import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { UserRole } from "../users/entities/user.entities";
import { uuidParam, validateBody } from "../../middleware/validate.middleware";
import { checkDiscount, createDiscount, deleteDiscount, getMyDiscounts, updateDiscount } from "./discount.controller";
import { checkDiscountSchema, createDiscountSchema, updateDiscountSchema } from "./discount.schemas";

const router = Router();
router.param("id", uuidParam);

const artisan = [authMiddleware, authorize(UserRole.ARTISAN)];

router.post("/check", authMiddleware, validateBody(checkDiscountSchema), checkDiscount);
router.get("/mine", ...artisan, getMyDiscounts);
router.post("/", ...artisan, validateBody(createDiscountSchema), createDiscount);
router.patch("/:id", ...artisan, validateBody(updateDiscountSchema), updateDiscount);
router.delete("/:id", ...artisan, deleteDiscount);

export default router;

import { z } from "zod";
import {
  cloudinaryImageUrl,
  email,
  newPassword,
  phone,
  requiredText,
} from "../../lib/schemas";
import { UserRole } from "./entities/user.entities";

export const registerSchema = z.object({
  name: requiredText("Name", 100),
  email: email(),
  password: newPassword(),
  phone: phone(),
  role: z.enum([UserRole.CLIENT, UserRole.ARTISAN], {
    error: "Choose whether you're joining as a client or an artisan",
  }),
  acceptTerms: z.literal(true, {
    error: "You must accept the Terms of Service to register",
  }),
});

export const loginSchema = z.object({
  email: email(),
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required")
    .max(128, "Invalid credentials"),
});

export const forgotPasswordSchema = z.object({ email: email() });

export const resetPasswordSchema = z.object({
  email: email(),
  token: z
    .string({ error: "Invalid or expired reset link" })
    .regex(/^[0-9a-f]{64}$/i, "Invalid or expired reset link"),
  newPassword: newPassword("New password"),
});

export const updateMeSchema = z.object({
  name: requiredText("Name", 100).optional(),
  phone: phone().optional(),
  avatarUrl: cloudinaryImageUrl("Avatar").nullable().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Current password is required" })
      .min(1, "Current password is required")
      .max(128, "Current password is incorrect"),
    newPassword: newPassword("New password"),
  })
  .refine((b) => b.currentPassword !== b.newPassword, {
    message: "Choose a new password that's different from the current one",
    path: ["newPassword"],
  });

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(UserRole, { error: "Invalid role" }).optional(),
    isActive: z
      .boolean({ error: "isActive must be true or false" })
      .optional(),
  })
  .refine((b) => b.role !== undefined || b.isActive !== undefined, {
    message: "Nothing to update",
  });

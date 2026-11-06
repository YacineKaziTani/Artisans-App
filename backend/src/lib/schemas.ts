import { z } from "zod";
import { UUID_RE } from "../middleware/validate.middleware";

// Reusable zod building blocks for request bodies. Messages are written for
// end users, since the frontend shows them as-is.

/** Multipart forms send "" for an untouched field; treat it as "not sent". */
export const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

export const uuid = (label = "id") =>
  z
    .string({ error: `${label} is required` })
    .regex(UUID_RE, `${label} is invalid`);

export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/**
 * Optional free text. `undefined` means "leave as is"; an empty string is
 * kept so update endpoints can use it to clear the field.
 */
export const optionalText = (label: string, max: number) =>
  z
    .string({ error: `${label} must be text` })
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional();

export const email = () =>
  z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address"));

export const newPassword = (label = "Password") =>
  z
    .string({ error: `${label} is required` })
    .min(8, `${label} must be at least 8 characters`)
    .max(128, `${label} must be at most 128 characters`);

export const phone = (label = "Phone number") =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(5, `Enter a valid ${label.toLowerCase()}`)
    .max(30, `Enter a valid ${label.toLowerCase()}`)
    .regex(/^\+?[0-9 ()\-.]+$/, `Enter a valid ${label.toLowerCase()}`);

const MAX_MONEY = 99_999_999.99; // decimal(10, 2)

const moneyCore = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .refine(Number.isFinite, `${label} must be a number`)
    .refine((n) => n >= min, `${label} must be at least $${min.toFixed(2)}`)
    .refine((n) => n <= max, `${label} must be at most $${max.toFixed(2)}`)
    // Money is stored with two decimals; anything finer is rounded to cents.
    .transform((n) => Math.round(n * 100) / 100);

export const money = (label: string, { min = 0, max = MAX_MONEY } = {}) =>
  z.preprocess(emptyToUndefined, moneyCore(label, min, max));

export const optionalMoney = (
  label: string,
  { min = 0, max = MAX_MONEY } = {},
) => z.preprocess(emptyToUndefined, moneyCore(label, min, max).optional());

/** Like optionalMoney, but `null` (or "") explicitly clears the value. */
export const clearableMoney = (
  label: string,
  { min = 0, max = MAX_MONEY } = {},
) =>
  z.preprocess(
    (v) => (v === "" ? null : v),
    moneyCore(label, min, max).nullable().optional(),
  );

const intCore = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

export const int = (label: string, min: number, max: number) =>
  z.preprocess(emptyToUndefined, intCore(label, min, max));

export const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(emptyToUndefined, intCore(label, min, max).optional());

/** Like optionalInt, but `null` (or "") explicitly clears the value. */
export const clearableInt = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" ? null : v),
    intCore(label, min, max).nullable().optional(),
  );

/** Multipart forms send booleans as strings. */
export const optionalBoolean = (label: string) =>
  z.preprocess(
    (v) => (v === "true" ? true : v === "false" ? false : v),
    z.boolean({ error: `${label} must be true or false` }).optional(),
  );

/**
 * An image hosted on this app's Cloudinary account — the only place uploads
 * go. Accepting any URL let users point their avatar at arbitrary sites
 * (tracking pixels, offensive images, javascript: URLs).
 */
export const cloudinaryImageUrl = (label: string) =>
  z
    .string({ error: `${label} must be a URL` })
    .trim()
    .max(500, `${label} is too long`)
    .refine((value) => {
      try {
        const url = new URL(value);
        const cloud = process.env.CLOUDINARY_CLOUD_NAME;
        return (
          url.protocol === "https:" &&
          url.hostname === "res.cloudinary.com" &&
          (!cloud || url.pathname.startsWith(`/${cloud}/`))
        );
      } catch {
        return false;
      }
    }, `${label} must be an image uploaded to this site`);

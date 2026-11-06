import { Request, Response, NextFunction } from "express";
import type { z } from "zod";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function describeIssue(issue: z.core.$ZodIssue) {
  const field = issue.path.join(".");
  if (!field) return issue.message;
  if (/received undefined/.test(issue.message)) return `${field} is required`;
  // zod's built-in messages ("Invalid input…", "Too small…") don't name the
  // field; our own messages already do.
  return /^(Invalid|Too )/.test(issue.message)
    ? `${field}: ${issue.message}`
    : issue.message;
}

/**
 * Validates (and normalizes — trims strings, lowercases emails, coerces
 * multipart numbers) the request body against a zod schema, replacing
 * req.body with the parsed result. Must run after multer for multipart
 * routes, since multer is what fills req.body there.
 */
export const validateBody =
  (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      return res.status(400).json({
        message: describeIssue(issue),
        field: issue.path.join(".") || undefined,
      });
    }
    req.body = result.data;
    next();
  };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export const uuidParam = (
  _req: Request,
  res: Response,
  next: NextFunction,
  value: string,
) => {
  if (!UUID_RE.test(value)) {
    return res.status(404).json({ message: "Not found" });
  }
  next();
};

export function parsePagination(
  query: { page?: unknown; limit?: unknown },
  { defaultLimit = 10, maxLimit = 50 } = {},
) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const requested = Math.floor(Number(query.limit)) || defaultLimit;
  const take = Math.min(Math.max(1, requested), maxLimit);
  return { page, take, skip: (page - 1) * take };
}

/** The `{ data, meta }` shape every paginated endpoint returns. */
export function pageResult<T>(
  data: T[],
  total: number,
  page: number,
  take: number,
) {
  return {
    data,
    meta: { total, page, lastPage: Math.max(1, Math.ceil(total / take)) },
  };
}

/** A single string from a query param (?a=x&a=y arrives as an array). */
export function queryString(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.trim() ? first.trim() : undefined;
}

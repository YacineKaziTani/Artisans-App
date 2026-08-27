import { Request, Response, NextFunction } from "express";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

import type { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { AdminAction } from "./admin-action.entities";
import { User, UserRole } from "../users/entities/user.entities";
import { isUuid } from "../../middleware/validate.middleware";

// Body fields worth keeping in the log (never passwords, tokens, notes with
// personal data beyond what the admin typed for the decision).
const LOGGED_FIELDS = [
  "status",
  "role",
  "isActive",
  "refundAmount",
  "resolutionNote",
  "adminNote",
  "note",
  "name",
  "trackingInfo",
  "isAvailable",
] as const;

function describe(action: string, targetType: string, body: Record<string, unknown>) {
  const parts = LOGGED_FIELDS.filter((f) => body?.[f] !== undefined && f !== "resolutionNote" && f !== "adminNote" && f !== "note")
    .map((f) => `${f}=${String(body[f])}`);
  return `${action}${parts.length ? ` (${parts.join(", ")})` : ""}`.slice(0, 500);
}

/**
 * Records an admin's change after it succeeds: who, what, on which record,
 * with the relevant request fields. On routes artisans also use (services,
 * order status), only admins' requests are logged. Never blocks the request.
 */
export function auditAdmin(action: string, targetType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      if (res.statusCode >= 400 || req.user?.role !== UserRole.SUPER_ADMIN) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const details = Object.fromEntries(LOGGED_FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));
      const id = String(req.params.id ?? "");
      const repo = AppDataSource.getRepository(AdminAction);
      repo
        .save(
          repo.create({
            admin: { id: req.user.id } as User,
            action,
            targetType,
            targetId: isUuid(id) ? id : null,
            summary: describe(action, targetType, body),
            details: Object.keys(details).length ? details : null,
          }),
        )
        .catch((err) => console.error("[audit] couldn't record admin action:", action, err));
    });
    next();
  };
}

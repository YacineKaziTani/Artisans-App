import { z } from "zod";
import { optionalText, requiredText, uuid } from "../../lib/schemas";
import { ReportStatus, ReportTargetType } from "./report.entities";

export const createReportSchema = z.object({
  targetType: z.enum(ReportTargetType, { error: "Invalid report type" }),
  targetId: uuid("targetId"),
  reason: requiredText("Reason", 1000).min(
    5,
    "Tell us a little more about the problem",
  ),
});

export const resolveReportSchema = z.object({
  status: z.enum(ReportStatus, { error: "Invalid status" }),
  adminNote: optionalText("Note", 1000),
});

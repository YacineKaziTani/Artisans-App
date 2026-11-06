import { z } from "zod";
import { optionalMoney, optionalText, requiredText, uuid } from "../../lib/schemas";
import { DisputeStatus, DisputeTargetType } from "./dispute.entities";

export const createDisputeSchema = z.object({
  targetType: z.enum(DisputeTargetType, { error: "Invalid dispute type" }),
  targetId: uuid("targetId"),
  reason: requiredText("Reason", 2000).min(
    10,
    "Describe what went wrong (at least 10 characters)",
  ),
});

export const resolveDisputeSchema = z.object({
  status: z.enum(
    [
      DisputeStatus.RESOLVED_REFUNDED,
      DisputeStatus.RESOLVED_DENIED,
      DisputeStatus.RESOLVED_OTHER,
    ],
    { error: "Invalid resolution status" },
  ),
  resolutionNote: optionalText("Resolution note", 2000),
  refundAmount: optionalMoney("Refund amount", { min: 0.01 }),
});

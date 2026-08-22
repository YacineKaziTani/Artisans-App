import { api } from "@/lib/axios";
import type { Dispute, DisputeStatus, DisputeTargetType } from "@/types";

export interface CreateDisputePayload {
  targetType: DisputeTargetType;
  targetId: string;
  reason: string;
}

export const disputeApi = {
  create: (payload: CreateDisputePayload) =>
    api.post<Dispute>("/disputes", payload).then((r) => r.data),

  mine: () => api.get<Dispute[]>("/disputes/mine").then((r) => r.data),

  listAllAdmin: (status?: DisputeStatus) =>
    api
      .get<Dispute[]>("/disputes/admin/all", {
        params: status ? { status } : {},
      })
      .then((r) => r.data),

  resolve: (id: string, status: DisputeStatus, resolutionNote?: string) =>
    api
      .patch<Dispute>(`/disputes/${id}/resolve`, { status, resolutionNote })
      .then((r) => r.data),
};

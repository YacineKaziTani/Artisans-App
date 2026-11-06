import { api } from "@/lib/axios";
import type { Dispute, DisputeStatus, DisputeTargetType, Page } from "@/types";

export interface CreateDisputePayload {
  targetType: DisputeTargetType;
  targetId: string;
  reason: string;
}

export const disputeApi = {
  create: (payload: CreateDisputePayload) =>
    api.post<Dispute>("/disputes", payload).then((r) => r.data),

  mine: () => api.get<Dispute[]>("/disputes/mine").then((r) => r.data),

  listAllAdmin: (status?: DisputeStatus, page = 1) =>
    api
      .get<Page<Dispute>>("/disputes/admin/all", {
        params: { page, ...(status ? { status } : {}) },
      })
      .then((r) => r.data),

  resolve: (
    id: string,
    status: DisputeStatus,
    resolutionNote?: string,
    refundAmount?: number,
  ) =>
    api
      .patch<Dispute>(`/disputes/${id}/resolve`, {
        status,
        resolutionNote,
        refundAmount,
      })
      .then((r) => r.data),
};

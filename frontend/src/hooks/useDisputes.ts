import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { disputeApi, type CreateDisputePayload } from "@/api/dispute.api";
import type { DisputeStatus } from "@/types";

export const disputeKeys = {
  mine: ["disputes", "mine"] as const,
  admin: (status?: DisputeStatus) => ["disputes", "admin", status ?? "all"] as const,
};

export function useCreateDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDisputePayload) => disputeApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: disputeKeys.mine });
    },
  });
}

export function useMyDisputes() {
  return useQuery({
    queryKey: disputeKeys.mine,
    queryFn: disputeApi.mine,
  });
}

export function useAdminDisputes(status?: DisputeStatus) {
  return useQuery({
    queryKey: disputeKeys.admin(status),
    queryFn: () => disputeApi.listAllAdmin(status),
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      resolutionNote,
    }: {
      id: string;
      status: DisputeStatus;
      resolutionNote?: string;
    }) => disputeApi.resolve(id, status, resolutionNote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disputes"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

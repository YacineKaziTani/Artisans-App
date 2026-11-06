import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { disputeApi, type CreateDisputePayload } from "@/api/dispute.api";
import type { DisputeStatus } from "@/types";

export const disputeKeys = {
  mine: ["disputes", "mine"] as const,
  admin: (status?: DisputeStatus, page = 1) =>
    ["disputes", "admin", status ?? "all", page] as const,
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

export function useAdminDisputes(status?: DisputeStatus, page = 1) {
  return useQuery({
    queryKey: disputeKeys.admin(status, page),
    queryFn: () => disputeApi.listAllAdmin(status, page),
    placeholderData: keepPreviousData,
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      resolutionNote,
      refundAmount,
    }: {
      id: string;
      status: DisputeStatus;
      resolutionNote?: string;
      refundAmount?: number;
    }) => disputeApi.resolve(id, status, resolutionNote, refundAmount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disputes"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

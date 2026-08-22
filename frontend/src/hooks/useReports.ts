import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reportApi, type CreateReportPayload } from "@/api/report.api";
import type { ReportStatus } from "@/types";

export const reportKeys = {
  admin: (status?: ReportStatus) => ["reports", "admin", status ?? "all"] as const,
};

export function useCreateReport() {
  return useMutation({
    mutationFn: (payload: CreateReportPayload) => reportApi.create(payload),
  });
}

export function useAdminReports(status?: ReportStatus) {
  return useQuery({
    queryKey: reportKeys.admin(status),
    queryFn: () => reportApi.listAllAdmin(status),
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      adminNote,
    }: {
      id: string;
      status: ReportStatus;
      adminNote?: string;
    }) => reportApi.resolve(id, status, adminNote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

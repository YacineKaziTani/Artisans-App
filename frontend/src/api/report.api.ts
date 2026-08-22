import { api } from "@/lib/axios";
import type { Report, ReportStatus, ReportTargetType } from "@/types";

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  reason: string;
}

export const reportApi = {
  create: (payload: CreateReportPayload) =>
    api.post<Report>("/reports", payload).then((r) => r.data),

  mine: () => api.get<Report[]>("/reports/mine").then((r) => r.data),

  listAllAdmin: (status?: ReportStatus) =>
    api
      .get<Report[]>("/reports/admin/all", { params: status ? { status } : {} })
      .then((r) => r.data),

  resolve: (id: string, status: ReportStatus, adminNote?: string) =>
    api.patch<Report>(`/reports/${id}`, { status, adminNote }).then((r) => r.data),
};

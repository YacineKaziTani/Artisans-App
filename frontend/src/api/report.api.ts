import { api } from "@/lib/axios";
import type { Page, Report, ReportStatus, ReportTargetType } from "@/types";

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
}

export const reportApi = {
  create: (payload: CreateReportPayload) =>
    api.post<Report>("/reports", payload).then((r) => r.data),

  mine: () => api.get<Report[]>("/reports/mine").then((r) => r.data),

  listAllAdmin: (status?: ReportStatus, page = 1) =>
    api
      .get<Page<Report>>("/reports/admin/all", {
        params: { page, ...(status ? { status } : {}) },
      })
      .then((r) => r.data),

  resolve: (id: string, status: ReportStatus, adminNote?: string) =>
    api.patch<Report>(`/reports/${id}`, { status, adminNote }).then((r) => r.data),
};

import { useState } from "react";
import { Pagination } from "@/components/Pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminReports, useResolveReport } from "@/hooks/useReports";
import type { ReportStatus } from "@/types";
import { getErrorMessage } from "@/lib/errors";
import { StatusBadge } from "@/components/StatusBadge";


export default function AdminReportsPage() {
  const [filter, setFilter] = useState<ReportStatus | undefined>("pending");
  const [page, setPage] = useState(1);
  const { data: reportsPage, isLoading, isError, isFetching } = useAdminReports(filter, page);
  const reports = reportsPage?.data;
  const resolveReport = useResolveReport();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">Flagged shops, products, services, and reviews</p>
      </div>

      <div className="flex gap-2">
        {(["pending", "dismissed", "actioned", undefined] as const).map((s) => (
          <button
            key={s ?? "all"}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              filter === s
                ? "bg-primary text-white border-primary"
                : "bg-card text-foreground/80 border-border"
            }`}
          >
            {s ?? "All"}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>{reportsPage?.meta.total ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
              Couldn't load reports.
            </p>
          )}

          {resolveReport.isError && (
            <p className="alert-error">{getErrorMessage(resolveReport.error)}</p>
          )}
          {!isLoading && !isError && (reports ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">No reports here.</p>
          )}

          {!isLoading &&
            !isError &&
            (reports ?? []).map((report) => {
              const isUpdating =
                resolveReport.isPending && resolveReport.variables?.id === report.id;

              return (
                <div key={report.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {report.targetType}: {report.targetLabel ?? report.targetId}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Reported by {report.reporter?.name} ·{" "}
                        {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="text-sm text-foreground">"{report.reason}"</p>
                  {report.adminNote && (
                    <p className="text-xs text-muted-foreground">Note: {report.adminNote}</p>
                  )}

                  {report.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={isUpdating}
                        onClick={() =>
                          resolveReport.mutate({ id: report.id, status: "actioned" })
                        }
                      >
                        Mark Actioned
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUpdating}
                        onClick={() =>
                          resolveReport.mutate({ id: report.id, status: "dismissed" })
                        }
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
        <Pagination meta={reportsPage?.meta} onPageChange={setPage} disabled={isFetching} />
        </CardContent>
      </Card>
    </div>
  );
}

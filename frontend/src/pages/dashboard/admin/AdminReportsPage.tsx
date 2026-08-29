import { useState } from "react";
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

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  dismissed: "bg-muted text-foreground/80 border-border",
  actioned: "bg-jade-50 text-jade-600 border-jade-500/25",
};

export default function AdminReportsPage() {
  const [filter, setFilter] = useState<ReportStatus | undefined>("pending");
  const { data: reports, isLoading, isError } = useAdminReports(filter);
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
            onClick={() => setFilter(s)}
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
          <CardDescription>{reports?.length ?? 0} total</CardDescription>
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
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_STYLES[report.status]}`}
                    >
                      {report.status}
                    </span>
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
        </CardContent>
      </Card>
    </div>
  );
}

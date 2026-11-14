import { ScrollText } from "lucide-react";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Pagination } from "@/components/Pagination";
import { api } from "@/lib/axios";
import { getErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";

interface AdminActionRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  admin: { id: string; name: string } | null;
  createdAt: string;
}

const FILTERS = [
  { value: "", label: "Everything" },
  { value: "user", label: "Users" },
  { value: "shop", label: "Shops" },
  { value: "dispute", label: "Disputes" },
  { value: "report", label: "Reports" },
  { value: "order", label: "Orders" },
  { value: "service", label: "Services" },
  { value: "category", label: "Categories" },
];

/** Who did what, and when — every admin change, newest first. */
export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState("");
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["admin", "audit", targetType, page],
    queryFn: () =>
      api
        .get<{ data: AdminActionRow[]; meta: { total: number; page: number; lastPage: number } }>("/audit", {
          params: { page, ...(targetType ? { targetType } : {}) },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Admin log" description="Every change made from the admin dashboard. Entries can't be edited." icon={ScrollText} />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            aria-pressed={targetType === f.value}
            onClick={() => {
              setTargetType(f.value);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              targetType === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="skeleton h-40" />}
      {isError && <p className="alert-error">{getErrorMessage(error, "Couldn't load the admin log.")}</p>}
      {data && data.data.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Admin</th>
                <th className="px-3 py-2 font-medium">What</th>
                <th className="px-3 py-2 font-medium">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.data.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.admin?.name ?? "Removed admin"}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.summary}</span>
                    {typeof row.details?.resolutionNote === "string" && (
                      <p className="text-xs text-muted-foreground">Note: {row.details.resolutionNote}</p>
                    )}
                    {typeof row.details?.adminNote === "string" && (
                      <p className="text-xs text-muted-foreground">Note: {row.details.adminNote}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {row.targetType}
                    {row.targetId ? ` #${row.targetId.slice(0, 8)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} onPageChange={setPage} disabled={isFetching} />
    </div>
  );
}

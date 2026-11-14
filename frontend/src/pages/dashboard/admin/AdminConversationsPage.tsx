import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useParams } from "react-router";
import { Pagination } from "@/components/Pagination";
import { useAdminConversations } from "@/hooks/useConversations";
import { PageHeader } from "@/components/PageHeader";

export default function AdminConversationsPage() {
  const [page, setPage] = useState(1);
  const { data: conversationsPage, isLoading, isError, isFetching } = useAdminConversations(page);
  const conversations = conversationsPage?.data;
  const { id: activeId } = useParams<{ id?: string }>();

  return (
    <div className="space-y-6">
      <PageHeader title="Conversations" description="All client ↔ artisan messages (read-only)" icon={MessageCircle} />

      <div className="flex gap-6 bg-card rounded-xl border border-border overflow-hidden min-h-[65vh]">
        <div
          className={`w-full sm:w-80 border-r border-border flex-shrink-0 ${activeId ? "hidden sm:block" : "block"}`}
        >
          {isLoading && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="p-4 text-sm text-destructive">
              Couldn't load conversations.
            </p>
          )}

          {!isLoading && !isError && (conversations ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
          )}

          {!isLoading &&
            !isError &&
            (conversations ?? []).map((c) => (
              <Link
                key={c.id}
                to={`/dashboard/messages/${c.id}`}
                className={`block px-4 py-3 border-b border-border hover:bg-accent ${
                  activeId === c.id ? "bg-brand-50" : ""
                }`}
              >
                <p className="font-medium text-foreground truncate">
                  {c.client?.name} ↔ {c.shop?.shopName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleString()}
                </p>
              </Link>
            ))}
          <div className="px-3 pb-3">
            <Pagination meta={conversationsPage?.meta} onPageChange={setPage} disabled={isFetching} />
          </div>
        </div>

        <div className={`flex-1 ${activeId ? "block" : "hidden sm:block"}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

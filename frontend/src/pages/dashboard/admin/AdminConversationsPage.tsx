import { Link, Outlet, useParams } from "react-router";
import { useAdminConversations } from "@/hooks/useConversations";

export default function AdminConversationsPage() {
  const { data: conversations, isLoading, isError } = useAdminConversations();
  const { id: activeId } = useParams<{ id?: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
        <p className="text-gray-600">All client ↔ artisan messages (read-only)</p>
      </div>

      <div className="flex gap-6 bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[65vh]">
        <div
          className={`w-full sm:w-80 border-r border-gray-200 flex-shrink-0 ${activeId ? "hidden sm:block" : "block"}`}
        >
          {isLoading && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="p-4 text-sm text-red-700">
              Couldn't load conversations.
            </p>
          )}

          {!isLoading && !isError && (conversations ?? []).length === 0 && (
            <p className="p-4 text-sm text-gray-600">No conversations yet.</p>
          )}

          {!isLoading &&
            !isError &&
            (conversations ?? []).map((c) => (
              <Link
                key={c.id}
                to={`/dashboard/messages/${c.id}`}
                className={`block px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                  activeId === c.id ? "bg-orange-50" : ""
                }`}
              >
                <p className="font-medium text-gray-900 truncate">
                  {c.client?.name} ↔ {c.shop?.shopName}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(c.updatedAt).toLocaleString()}
                </p>
              </Link>
            ))}
        </div>

        <div className={`flex-1 ${activeId ? "block" : "hidden sm:block"}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

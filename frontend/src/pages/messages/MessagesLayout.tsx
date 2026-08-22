import { Link, Outlet, useParams } from "react-router";
import { useMyConversations } from "@/hooks/useConversations";
import { useAuthStore } from "@/store/auth.store";

export default function MessagesLayout() {
  const { data: conversations, isLoading, isError } = useMyConversations();
  const { id: activeId } = useParams<{ id?: string }>();
  const user = useAuthStore((s) => s.user);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/">Go Back to App</Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Messages</h1>

        <div className="flex gap-6 bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[70vh]">
          <div
            className={`w-full sm:w-80 border-r border-gray-200 flex-shrink-0 ${activeId ? "hidden sm:block" : "block"}`}
          >
            {isLoading && (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 rounded-lg bg-gray-100 animate-pulse"
                  />
                ))}
              </div>
            )}

            {isError && (
              <p className="p-4 text-sm text-red-700">
                Couldn't load your conversations.
              </p>
            )}

            {!isLoading && !isError && (conversations ?? []).length === 0 && (
              <p className="p-4 text-sm text-gray-600">
                No conversations yet. Message an artisan from their shop page to
                get started.
              </p>
            )}

            {!isLoading &&
              !isError &&
              (conversations ?? []).map((c) => {
                const isMe = c.shop?.owner?.id === user?.id;
                const otherPartyName = isMe ? c.client?.name : c.shop?.shopName;

                return (
                  <Link
                    key={c.id}
                    to={`/messages/${c.id}`}
                    className={`block px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                      activeId === c.id ? "bg-orange-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900 truncate">
                        {otherPartyName ?? "Conversation"}
                      </p>
                      {!!c.unreadCount && (
                        <span className="bg-orange-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(c.updatedAt).toLocaleString()}
                    </p>
                  </Link>
                );
              })}
          </div>

          <div className={`flex-1 ${activeId ? "block" : "hidden sm:block"}`}>
            <Outlet />
          </div>
        </div>
      </div>
    </main>
  );
}

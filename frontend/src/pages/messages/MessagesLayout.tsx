import { useMemo, useState } from "react";
import { Link, Outlet, useParams } from "react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { Input } from "@/components/ui/input";
import { PartyAvatar } from "@/components/messages/PartyAvatar";
import { useMyConversations } from "@/hooks/useConversations";
import { useAuthStore } from "@/store/auth.store";

export default function MessagesLayout() {
  const { data: conversations, isLoading, isError } = useMyConversations();
  const { id: activeId } = useParams<{ id?: string }>();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const list = (conversations ?? []).map((c) => ({
      conversation: c,
      name:
        (c.shop?.owner?.id === user?.id ? c.client?.name : c.shop?.shopName) ??
        "Conversation",
    }));
    const needle = filter.trim().toLowerCase();
    return needle
      ? list.filter((r) => r.name.toLowerCase().includes(needle))
      : list;
  }, [conversations, user?.id, filter]);

  const totalUnread = (conversations ?? []).reduce(
    (sum, c) => sum + (c.unreadCount ?? 0),
    0,
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <span aria-hidden="true">←</span> Back to home
        </Link>

        <div className="flex items-baseline gap-3 mb-6">
          <h1 className="text-3xl font-bold text-foreground">Messages</h1>
          {totalUnread > 0 && (
            <span className="text-sm text-muted-foreground">
              {totalUnread} unread
            </span>
          )}
        </div>

        <div className="flex bg-card rounded-xl border border-border overflow-hidden shadow-sm h-[calc(100vh-13rem)] min-h-[28rem]">
          <aside
            className={`w-full sm:w-80 border-r border-border flex-shrink-0 flex flex-col ${
              activeId ? "hidden sm:flex" : "flex"
            }`}
          >
            <div className="p-3 border-b border-border flex-shrink-0">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="h-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 rounded-lg bg-muted animate-pulse"
                    />
                  ))}
                </div>
              )}

              {isError && (
                <p className="p-4 text-sm text-destructive">
                  Couldn't load your conversations.
                </p>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-3xl mb-2" aria-hidden="true">
                    💬
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {filter
                      ? "No conversations match that search."
                      : "No conversations yet. Message an artisan from their shop page to get started."}
                  </p>
                </div>
              )}

              {!isLoading &&
                !isError &&
                rows.map(({ conversation: c, name }) => {
                  const isActive = activeId === c.id;
                  const unread = c.unreadCount ?? 0;

                  return (
                    <Link
                      key={c.id}
                      to={`/messages/${c.id}`}
                      aria-current={isActive ? "page" : undefined}
                      className={`relative flex items-center gap-3 px-4 py-3 border-b border-border/60 transition-colors ${
                        isActive ? "bg-accent/10" : "hover:bg-muted/60"
                      }`}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
                        />
                      )}
                      <PartyAvatar name={name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate ${
                              unread
                                ? "font-semibold text-foreground"
                                : "font-medium text-foreground/90"
                            }`}
                          >
                            {name}
                          </p>
                          <time
                            dateTime={c.updatedAt}
                            className="text-[11px] text-muted-foreground flex-shrink-0"
                          >
                            {formatDistanceToNowStrict(new Date(c.updatedAt), {
                              addSuffix: false,
                            })}
                          </time>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {c.shop?.owner?.id === user?.id
                              ? "Customer"
                              : "Shop"}
                          </p>
                          {unread > 0 && (
                            <span className="bg-primary text-primary-foreground text-[11px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center flex-shrink-0">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </aside>

          <section
            className={`flex-1 min-w-0 ${activeId ? "block" : "hidden sm:block"}`}
          >
            <Outlet />
          </section>
        </div>
      </div>
    </main>
  );
}

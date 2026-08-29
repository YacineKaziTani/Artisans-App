import { Link, useParams } from "react-router";
import { useAdminConversationMessages } from "@/hooks/useConversations";

export default function AdminConversationThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useAdminConversationMessages(id);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-full flex items-center justify-center text-destructive text-sm">
        Couldn't load this conversation.
      </div>
    );
  }

  const { conversation, messages } = data;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <Link
            to="/dashboard/messages"
            className="sm:hidden text-sm text-primary mr-2"
          >
            ←
          </Link>
          <span className="font-semibold text-foreground">
            {conversation.client?.name} ↔ {conversation.shop?.shopName}
          </span>
        </div>
        {conversation.shop && (
          <Link
            to={`/artisan/${conversation.shop.id}`}
            className="text-sm text-primary hover:underline"
          >
            View Shop
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-8">No messages yet.</p>
        )}
        {messages.map((m) => {
          const isClient = m.sender?.id === conversation.client?.id;
          return (
            <div key={m.id} className={`flex ${isClient ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                  isClient
                    ? "bg-muted text-foreground rounded-bl-sm"
                    : "bg-brand-100 text-foreground rounded-br-sm"
                }`}
              >
                <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                  {m.sender?.name}
                </p>
                <p>{m.content}</p>
                <p className="text-[10px] mt-1 opacity-60">
                  {new Date(m.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

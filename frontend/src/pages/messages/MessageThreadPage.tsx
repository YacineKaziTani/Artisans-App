import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConversationMessages, useSendMessage } from "@/hooks/useConversations";
import { useAuthStore } from "@/store/auth.store";
import { getSocket } from "@/lib/socket";

export default function MessageThreadPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useConversationMessages(id);
  const sendMessage = useSendMessage(id ?? "");
  const [content, setContent] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Join/leave the socket room for this conversation so messages sent by
  // the other party arrive here in real time.
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    socket.emit("join_conversation", id);
    return () => {
      socket.emit("leave_conversation", id);
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    const handleTyping = (payload: { userId: string; isTyping: boolean }) => {
      if (payload.userId === user?.id) return;
      setOtherTyping(payload.isTyping);
    };
    socket.on("typing", handleTyping);
    return () => {
      socket.off("typing", handleTyping);
    };
  }, [id, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !id) return;
    getSocket().emit("typing", { conversationId: id, isTyping: false });
    sendMessage.mutate(content.trim(), { onSuccess: () => setContent("") });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    if (!id) return;
    const socket = getSocket();
    socket.emit("typing", { conversationId: id, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { conversationId: id, isTyping: false });
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-full flex items-center justify-center text-red-600 text-sm">
        Couldn't load this conversation.
      </div>
    );
  }

  const { conversation, messages } = data;
  const isArtisanSide = conversation.shop?.owner?.id === user?.id;
  const otherPartyName = isArtisanSide
    ? conversation.client?.name
    : conversation.shop?.shopName;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <Link to="/messages" className="sm:hidden text-sm text-orange-700 mr-2">
            ←
          </Link>
          <span className="font-semibold text-gray-900">{otherPartyName}</span>
        </div>
        {conversation.shop && !isArtisanSide && (
          <Link
            to={`/artisan/${conversation.shop.id}`}
            className="text-sm text-orange-700 hover:underline"
          >
            View Shop
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-8">
            No messages yet — say hello.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender?.id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                  mine
                    ? "bg-orange-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-900 rounded-bl-sm"
                }`}
              >
                <p>{m.content}</p>
                <p
                  className={`text-[10px] mt-1 ${mine ? "text-orange-100" : "text-gray-400"}`}
                >
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 text-xs rounded-2xl rounded-bl-sm px-4 py-2 italic">
              typing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-gray-200 flex gap-2">
        <Input
          value={content}
          onChange={handleContentChange}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button type="submit" disabled={sendMessage.isPending || !content.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}

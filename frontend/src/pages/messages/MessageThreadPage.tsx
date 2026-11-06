import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { format, isThisYear, isToday, isYesterday } from "date-fns";
import { Button } from "@/components/ui/button";
import { PartyAvatar } from "@/components/messages/PartyAvatar";
import {
  conversationKeys,
  useConversationMessages,
  useLoadEarlierMessages,
  useSendMessage,
} from "@/hooks/useConversations";
import { useAuthStore } from "@/store/auth.store";
import { getSocket } from "@/lib/socket";
import { getErrorMessage } from "@/lib/errors";
import type { ChatMessage } from "@/types";

const MAX_MESSAGE_LENGTH = 2000;
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, isThisYear(date) ? "EEEE, d MMMM" : "d MMMM yyyy");
}

interface RenderedMessage {
  message: ChatMessage;
  mine: boolean;
  startsRun: boolean;
  endsRun: boolean;
  daySeparator?: string;
}

function layOutMessages(
  messages: ChatMessage[],
  currentUserId?: string,
): RenderedMessage[] {
  return messages.map((message, i) => {
    const previous = messages[i - 1];
    const next = messages[i + 1];
    const at = new Date(message.createdAt).getTime();
    const mine = message.sender?.id === currentUserId;

    const sameSenderAs = (other?: ChatMessage) =>
      Boolean(other) && other!.sender?.id === message.sender?.id;
    const closeTo = (other?: ChatMessage) =>
      Boolean(other) &&
      Math.abs(new Date(other!.createdAt).getTime() - at) < GROUPING_WINDOW_MS;

    const newDay =
      !previous ||
      new Date(previous.createdAt).toDateString() !==
        new Date(message.createdAt).toDateString();

    return {
      message,
      mine,
      startsRun: newDay || !sameSenderAs(previous) || !closeTo(previous),
      endsRun: !sameSenderAs(next) || !closeTo(next),
      daySeparator: newDay ? dayLabel(new Date(message.createdAt)) : undefined,
    };
  });
}

export default function MessageThreadPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useConversationMessages(id);
  const sendMessage = useSendMessage(id ?? "");
  const loadEarlier = useLoadEarlierMessages(id ?? "");
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    socket.emit("join_conversation", id);

    // Rooms don't survive a reconnect (network blip, server restart), and
    // live messages silently stopped arriving after one. Rejoin, and refetch
    // to pick up anything sent while we were disconnected.
    let connectedBefore = socket.connected;
    const handleConnect = () => {
      socket.emit("join_conversation", id);
      if (connectedBefore) {
        qc.invalidateQueries({ queryKey: conversationKeys.messages(id) });
      }
      connectedBefore = true;
    };
    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.emit("leave_conversation", id);
    };
  }, [id, qc]);

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

  // Follow the newest message — keyed on the last message, not the count,
  // so loading earlier history doesn't yank the view to the bottom.
  const lastMessageId = data?.messages[data.messages.length - 1]?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId, otherTyping]);

  const rendered = useMemo(
    () => layOutMessages(data?.messages ?? [], user?.id),
    [data?.messages, user?.id],
  );

  const send = () => {
    const trimmed = content.trim();
    if (!trimmed || !id || trimmed.length > MAX_MESSAGE_LENGTH) return;
    getSocket().emit("typing", { conversationId: id, isTyping: false });
    sendMessage.mutate(trimmed, {
      onSuccess: () => {
        setContent("");
        if (inputRef.current) inputRef.current.style.height = "auto";
      },
    });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    const field = e.target;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 140)}px`;

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
      <div className="h-full flex flex-col justify-end gap-3 p-4">
        {[60, 40, 70, 45].map((width, i) => (
          <div
            key={i}
            className={`h-10 rounded-2xl bg-muted animate-pulse ${
              i % 2 ? "self-end" : "self-start"
            }`}
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-4xl" aria-hidden="true">
          ⚠️
        </span>
        <p className="text-sm text-destructive">
          Couldn't load this conversation.
        </p>
        <Link to="/messages" className="text-sm text-primary hover:underline">
          Back to all messages
        </Link>
      </div>
    );
  }

  const { conversation } = data;
  const isArtisanSide = conversation.shop?.owner?.id === user?.id;
  const otherPartyName =
    (isArtisanSide ? conversation.client?.name : conversation.shop?.shopName) ??
    "Conversation";
  const remaining = MAX_MESSAGE_LENGTH - content.length;

  return (
    <div className="h-full flex flex-col min-h-0">
      <header className="px-4 py-3 border-b border-border flex items-center gap-3 flex-shrink-0 bg-card">
        <Link
          to="/messages"
          className="sm:hidden text-muted-foreground hover:text-foreground text-lg leading-none"
          aria-label="Back to conversations"
        >
          ←
        </Link>
        <PartyAvatar name={otherPartyName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">
            {otherPartyName}
          </p>
          <p className="text-xs text-muted-foreground">
            {isArtisanSide ? "Customer" : "Shop"}
          </p>
        </div>
        {conversation.shop && !isArtisanSide && (
          <Link to={`/artisan/${conversation.shop.id}`}>
            <Button variant="outline" size="sm">
              View shop
            </Button>
          </Link>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {data.hasMore && (
          <div className="flex justify-center mb-4">
            <Button
              size="sm"
              variant="outline"
              disabled={loadEarlier.isPending}
              onClick={() => loadEarlier.mutate()}
            >
              {loadEarlier.isPending ? "Loading…" : "Load earlier messages"}
            </Button>
          </div>
        )}
        {rendered.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2">
            <PartyAvatar name={otherPartyName} />
            <p className="font-medium text-foreground">{otherPartyName}</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              No messages yet — say hello and start the conversation.
            </p>
          </div>
        )}

        {rendered.map(({ message, mine, startsRun, endsRun, daySeparator }) => (
          <div key={message.id}>
            {daySeparator && (
              <div className="flex items-center gap-3 my-4">
                <span className="flex-1 h-px bg-border" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {daySeparator}
                </span>
                <span className="flex-1 h-px bg-border" />
              </div>
            )}

            <div
              className={`flex items-end gap-2 ${
                mine ? "justify-end" : "justify-start"
              } ${endsRun ? "mb-3" : "mb-0.5"}`}
            >
              {!mine &&
                (startsRun ? (
                  <PartyAvatar name={message.sender?.name} size="sm" />
                ) : (
                  <span className="w-9 flex-shrink-0" aria-hidden="true" />
                ))}

              <div
                className={`max-w-[75%] px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                } rounded-2xl ${
                  mine
                    ? `rounded-br-md ${startsRun ? "" : "rounded-tr-md"}`
                    : `rounded-bl-md ${startsRun ? "" : "rounded-tl-md"}`
                }`}
              >
                <p>{message.content}</p>
                {endsRun && (
                  <time
                    dateTime={message.createdAt}
                    className={`block text-[10px] mt-1 ${
                      mine
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(message.createdAt), "HH:mm")}
                  </time>
                )}
              </div>
            </div>
          </div>
        ))}

        {otherTyping && (
          <div className="flex items-end gap-2 justify-start">
            <span className="w-9 flex-shrink-0" aria-hidden="true" />
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
              <span className="sr-only">{otherPartyName} is typing</span>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="p-3 border-t border-border flex-shrink-0 bg-card"
      >
        {sendMessage.isError && (
          <p className="text-xs text-destructive mb-2">
            {getErrorMessage(
              sendMessage.error,
              "Couldn't send that message. Please try again.",
            )}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Type a message…"
            aria-label="Message"
            className="flex-1 resize-none rounded-2xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 max-h-35"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full h-10 w-10 flex-shrink-0"
            disabled={sendMessage.isPending || !content.trim()}
            aria-label="Send message"
          >
            <span aria-hidden="true">↑</span>
          </Button>
        </div>
        <div className="flex justify-between items-center mt-1.5 px-1">
          <p className="text-[11px] text-muted-foreground">
            Enter to send · Shift + Enter for a new line
          </p>
          {remaining < 200 && (
            <p
              className={`text-[11px] ${
                remaining < 0 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {remaining}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

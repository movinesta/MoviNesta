import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Pin, Search, Send, Sparkles, Trash2, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/modules/auth/AuthProvider";
import { toast } from "@/components/toasts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/chip";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useConversationMessages } from "@/modules/messages/useConversationMessages";
import { useSendMessage } from "@/modules/messages/useSendMessage";
import type { ConversationMessage } from "@/modules/messages/messageModel";

type AssistantMode = "General" | "Recommendations" | "Watchlist" | "Explain" | "Mood";

type PinItem = {
  id: string;
  text: string;
  createdAt: string;
};

const PINS_KEY = "movinesta.assistant.pins.v1";

function safeRandomId() {
  try {
    // modern browsers
    return crypto.randomUUID();
  } catch {
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function getMessageText(m: ConversationMessage) {
  return (m.text ?? m.body ?? "").toString();
}

function loadPins(): PinItem[] {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

function savePins(pins: PinItem[]) {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  } catch {
    // ignore
  }
}

export default function AssistantChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = React.useState(true);
  const [mode, setMode] = React.useState<AssistantMode>("General");
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [isThinking, setIsThinking] = React.useState(false);
  const [lastUserClientId, setLastUserClientId] = React.useState<string | null>(null);
  const [pins, setPins] = React.useState<PinItem[]>(() => loadPins());

  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = React.useRef(true);

  React.useEffect(() => {
    if (!user) return;

    let alive = true;
    (async () => {
      setLoadingConversation(true);
      const { data, error } = await supabase.functions.invoke("assistant-get-conversation");
      if (!alive) return;
      if (error) {
        console.error("assistant-get-conversation", error);
        toast.show("Couldn't load your assistant chat. Try again.", {
          title: "Assistant",
          variant: "error",
        });
        setLoadingConversation(false);
        return;
      }

      const id = (data as any)?.conversationId as string | undefined;
      if (!id) {
        toast.show("Assistant chat couldn't be created (missing conversationId).", {
          title: "Assistant",
          variant: "error",
        });
        setLoadingConversation(false);
        return;
      }

      setConversationId(id);
      setLoadingConversation(false);
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  const {
    data: messagesData,
    isLoading: loadingMessages,
    hasMore,
    loadOlder,
    isLoadingOlder,
  } = useConversationMessages(conversationId);

  const sendMessage = useSendMessage(conversationId);

  const messages = React.useMemo(() => {
    const rows = Array.isArray(messagesData) ? messagesData : [];
    const ordered = rows.slice().sort((a, b) => {
      const t = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (t !== 0) return t;
      return String(a.id).localeCompare(String(b.id));
    });

    if (!query.trim()) return ordered;
    const q = query.trim().toLowerCase();
    return ordered.filter((m) => getMessageText(m).toLowerCase().includes(q));
  }, [messagesData, query]);

  // Detect when assistant replied after the last sent user message.
  React.useEffect(() => {
    if (!isThinking || !lastUserClientId) return;
    // If we see any message from a different user than current, after the clientId message, stop thinking.
    const idx = messages.findIndex((m) => (m.clientId ?? null) === lastUserClientId);
    if (idx < 0) return;
    const after = messages.slice(idx + 1);
    if (after.some((m) => m.senderId !== user?.id)) {
      setIsThinking(false);
      setLastUserClientId(null);
    }
  }, [isThinking, lastUserClientId, messages, user?.id]);

  // Track whether user is at bottom, then auto-scroll only when they are.
  const onScrollCapture = React.useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  }, []);

  React.useEffect(() => {
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  React.useEffect(() => {
    savePins(pins);
  }, [pins]);

  const quickPrompts = React.useMemo(
    () =>
      [
        {
          label: "Pick a movie tonight",
          mode: "Recommendations" as const,
          text: "Recommend 5 movies for tonight based on my mood (ask me 1 question first).",
        },
        {
          label: "Build my watchlist",
          mode: "Watchlist" as const,
          text: "Help me build a 10-item watchlist. Ask what genres, pacing, and language I want.",
        },
        {
          label: "Explain a film ending",
          mode: "Explain" as const,
          text: "Explain the ending of a movie (I'll paste the title and what confused me).",
        },
        {
          label: "Mood-based picks",
          mode: "Mood" as const,
          text: "I'm feeling: <replace>. Suggest movies or series that match.",
        },
      ] as const,
    [],
  );

  const handleSend = React.useCallback(async () => {
    const text = draft.trim();
    if (!text || !conversationId || !userId) return;

    const clientId = safeRandomId();
    setIsThinking(true);
    setLastUserClientId(clientId);

    try {
      await sendMessage.mutateAsync({ text, clientId });
      setDraft("");

      const { error } = await supabase.functions.invoke("assistant-chat-reply", {
        body: {
          conversationId,
          userId,
          text,
          clientId,
          surface: "messages",
          mode,
        },
      });

      if (error) {
        console.error("assistant-chat-reply", error);
        toast.show("Your message was sent, but the assistant failed to respond.", {
          title: "Assistant",
          variant: "error",
        });
        setIsThinking(false);
        setLastUserClientId(null);
      }
    } catch (e) {
      console.error(e);
      toast.show(e instanceof Error ? e.message : "Unknown error", {
        title: "Message failed",
        variant: "error",
      });
      setIsThinking(false);
      setLastUserClientId(null);
    }
  }, [draft, conversationId, userId, sendMessage, mode]);

  const canSend = !!draft.trim() && !sendMessage.isPending && !!conversationId;

  const addPin = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPins((prev) => {
      const next: PinItem[] = [
        { id: safeRandomId(), text: trimmed, createdAt: new Date().toISOString() },
        ...prev,
      ];
      return next.slice(0, 20);
    });
    toast.success("Saved to your assistant sidebar (local).", { title: "Pinned" });
  };

  const removePin = (id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard.", { title: "Copied" });
    } catch {
      toast.error("Couldn't copy to clipboard.", { title: "Copy failed" });
    }
  };

  if (!user) {
    // Shouldn't happen due to RequireAuth, but keep a safe fallback.
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="font-semibold">Sign in required</div>
          <div className="text-sm text-muted-foreground mt-1">
            Please sign in to use the assistant.
          </div>
          <div className="mt-4">
            <Button onClick={() => navigate("/auth/signin")}>Go to sign in</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[100svh] w-full overflow-hidden bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 border flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight">AI Assistance</div>
            <div className="text-xs text-muted-foreground">
              {loadingConversation ? "Preparing your chat…" : isThinking ? "Thinking…" : "Ready"}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              {(
                ["General", "Recommendations", "Watchlist", "Explain", "Mood"] as AssistantMode[]
              ).map((m) => (
                <Chip
                  key={m}
                  variant={mode === m ? "accent" : "outline"}
                  onClick={() => setMode(m)}
                  className="cursor-pointer"
                >
                  {m}
                </Chip>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/messages")}>
              Messages
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl h-[calc(100svh-57px)] px-4 py-4 grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-4">
        {/* Left rail */}
        <div className="hidden lg:flex flex-col gap-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">Quick actions</div>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((p) => (
                <Chip
                  key={p.label}
                  className="cursor-pointer"
                  onClick={() => {
                    setMode(p.mode);
                    setDraft(p.text);
                  }}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-3">
              Tip: pick a mode, then hit Send.
            </div>
          </Card>

          <Card className="p-4 flex-1 min-h-0">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Pin className="h-4 w-4" />
                Pinned
              </div>
              {pins.length > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPins([]);
                    toast.success("Pinned items cleared (local).", { title: "Cleared" });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <ScrollArea className="h-full">
              <div className="space-y-2">
                {pins.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Pin an assistant reply to keep it here.
                  </div>
                ) : (
                  pins.map((p) => (
                    <div key={p.id} className="group rounded-xl border bg-background/60 p-3">
                      <div className="text-sm whitespace-pre-wrap break-words">{p.text}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(p.createdAt).toLocaleString()}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(p.text)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removePin(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Chat */}
        <Card className="min-h-0 flex flex-col overflow-hidden">
          {/* Search + load older */}
          <div className="p-3 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search this chat"
                className="pl-9"
              />
            </div>

            {hasMore ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadOlder()}
                disabled={isLoadingOlder}
              >
                {isLoadingOlder ? <Loader2 className="h-4 w-4 animate-spin" /> : "Older"}
              </Button>
            ) : null}
          </div>

          {/* Messages */}
          <div
            className="flex-1 min-h-0"
            onScrollCapture={onScrollCapture}
            ref={scrollAreaRef as any}
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {loadingConversation || loadingMessages ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Start a new conversation with the assistant.
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderId === user?.id;
                    const text = getMessageText(m);
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "group max-w-[92%] sm:max-w-[78%] rounded-2xl px-4 py-3 border shadow-sm",
                            mine
                              ? "bg-primary text-primary-foreground border-primary/20"
                              : "bg-background/70 border-border/60",
                          )}
                        >
                          <div className="text-sm whitespace-pre-wrap break-words">{text}</div>
                          <div
                            className={cn(
                              "mt-2 flex items-center gap-2",
                              mine ? "justify-end" : "justify-start",
                            )}
                          >
                            <div
                              className={cn(
                                "text-[11px]",
                                mine ? "text-primary-foreground/70" : "text-muted-foreground",
                              )}
                            >
                              {new Date(m.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>

                            {!mine ? (
                              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(text)}
                                  className="h-7 px-2"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => addPin(text)}
                                  className="h-7 px-2"
                                >
                                  <Pin className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {isThinking ? (
                  <div className="flex justify-start">
                    <div className="max-w-[92%] sm:max-w-[78%] rounded-2xl px-4 py-3 border bg-background/70 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking…
                    </div>
                  </div>
                ) : null}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Composer */}
          <div className="p-3 border-t bg-background/70">
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  mode === "Recommendations"
                    ? "Tell me what you feel like watching…"
                    : mode === "Watchlist"
                      ? "What kind of watchlist do you want?"
                      : mode === "Explain"
                        ? "Paste the title + what confused you…"
                        : mode === "Mood"
                          ? "Describe your mood (e.g. cozy, intense, funny)…"
                          : "Ask anything…"
                }
                className="min-h-[52px] max-h-40"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button
                disabled={!canSend}
                onClick={() => void handleSend()}
                className="h-[52px] rounded-xl"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                Enter to send • Shift+Enter for newline
              </div>
              <div className="sm:hidden flex items-center gap-2">
                <Chip variant="accent" className="cursor-default">
                  {mode}
                </Chip>
              </div>
            </div>
          </div>
        </Card>

        {/* Right rail */}
        <div className="hidden lg:flex flex-col gap-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">What I can do</div>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
              <li>Recommend movies & series (mood, genre, length)</li>
              <li>Build watchlists and watching plans</li>
              <li>Explain endings, themes, and characters</li>
              <li>Suggest similar titles based on one example</li>
            </ul>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Privacy</div>
            <div className="text-sm text-muted-foreground">
              Pinned items are stored only in your browser (localStorage). Messages are stored in
              your MoviNesta database.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { setAssistantCache } from "@/lib/assistantCache";

export default function AssistantRedirectPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      let data: any;
      try {
        data = await callSupabaseFunction<any>(
          "assistant-get-conversation",
          { reason: "ui" },
          { requireAuth: true },
        );
      } catch (e: any) {
        if (cancelled) return;
        setError(String(e?.message ?? "Failed to open assistant conversation"));
        return;
      }

      if (cancelled) return;

      const conversationId = (data as any)?.conversationId as string | undefined;
      const assistant = (data as any)?.assistant as any | undefined;
      if (conversationId && assistant?.id) {
        setAssistantCache({
          conversationId,
          assistant: {
            id: String(assistant.id),
            username: assistant.username ?? null,
            display_name: assistant.display_name ?? null,
            avatar_url: assistant.avatar_url ?? null,
          },
          updatedAt: Date.now(),
        });
      }

      if (!conversationId) {
        setError("assistant-get-conversation: missing conversationId");
        return;
      }

      navigate(`/messages/${conversationId}?assistant=1`, { replace: true });
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin mb-3" />
        Opening assistant…
        {error ? <div className="mt-3 text-destructive">{error}</div> : null}
      </div>
    </div>
  );
}

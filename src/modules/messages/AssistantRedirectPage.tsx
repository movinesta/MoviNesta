import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AssistantRedirectPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { data, error } = await supabase.functions.invoke("assistant-get-conversation", {
        body: { reason: "ui" },
      });

      if (cancelled) return;

      if (error) {
        setError(error.message || "Failed to open assistant conversation");
        return;
      }

      const conversationId = (data as any)?.conversationId as string | undefined;
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

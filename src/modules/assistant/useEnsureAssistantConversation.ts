import * as React from "react";
import { supabase } from "@/lib/supabase";
import { getAssistantCache, setAssistantCache } from "@/lib/assistantCache";
import { useAuth } from "@/modules/auth/AuthProvider";

/**
 * Ensures the assistant DM exists for the signed-in user.
 *
 * This makes the assistant feel "not broken" because:
 * - The assistant thread exists immediately (new users see it pinned).
 * - The client caches the real assistant identity (no hardcoded UUIDs).
 */
export function useEnsureAssistantConversation() {
  const { user } = useAuth();

  React.useEffect(() => {
    if (!user) return;

    const cached = getAssistantCache();
    // If we refreshed recently (within 6 hours), avoid re-hitting the edge function.
    if (cached?.updatedAt && Date.now() - cached.updatedAt < 6 * 60 * 60 * 1000) return;

    let alive = true;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("assistant-get-conversation", {
          body: { reason: "bootstrap" },
        });

        if (!alive) return;
        if (error) return;

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
      } catch {
        // silent; assistant is optional
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);
}

import * as React from "react";
import { useNavigate } from "react-router-dom";

import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { setAssistantCache } from "@/lib/assistantCache";
import { useAuth } from "@/modules/auth/AuthProvider";
import { toast } from "@/components/toasts";
import { LoadingScreen } from "@/components/ui/loading-screen";

/**
 * Assistant entry route.
 *
 * The assistant DM is implemented as a normal direct conversation (user <-> assistant user)
 * and therefore uses the same ConversationPage UI as any other chat.
 *
 * This route just ensures the conversation exists, then redirects to /messages/:conversationId.
 */
export default function AssistantChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  React.useEffect(() => {
    if (!user) return;

    let alive = true;

    (async () => {
      let data: any;
      try {
        data = await callSupabaseFunction<any>(
          "assistant-get-conversation",
          {},
          { requireAuth: true },
        );
      } catch (e) {
        if (!alive) return;
        console.error("assistant-get-conversation", e);
        toast.show("Couldn't open the assistant chat. Please try again.", {
          title: "Assistant",
          variant: "error",
        });
        navigate("/messages", { replace: true });
        return;
      }

      if (!alive) return;

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
        toast.show("Assistant chat couldn't be created (missing conversationId).", {
          title: "Assistant",
          variant: "error",
        });
        navigate("/messages", { replace: true });
        return;
      }

      navigate(`/messages/${conversationId}`, { replace: true });
    })();

    return () => {
      alive = false;
    };
  }, [navigate, user]);

  return <LoadingScreen />;
}

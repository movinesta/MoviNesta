import * as React from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";
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
      const { data, error } = await supabase.functions.invoke("assistant-get-conversation");
      if (!alive) return;

      if (error) {
        console.error("assistant-get-conversation", error);
        toast.show("Couldn't open the assistant chat. Please try again.", {
          title: "Assistant",
          variant: "error",
        });
        navigate("/messages", { replace: true });
        return;
      }

      const conversationId = (data as any)?.conversationId as string | undefined;
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

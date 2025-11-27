import React from "react";
import { MessageCircle } from "lucide-react";

import { PageHeader, PageSection } from "../../components/PageChrome";
import { useAuth } from "../auth/AuthProvider";
import { useCurrentProfile } from "../profile/useProfile";
import { RealtimeChat } from "@/components/realtime-chat";

/**
 * Global realtime chat room powered by Supabase Realtime.
 *
 * This page expects the `RealtimeChat` component from
 * `@supabase/realtime-chat-react-router` to be installed via:
 *
 *   npx shadcn@latest add @supabase/realtime-chat-react-router
 */
const RealtimeChatPage: React.FC = () => {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();

  if (!user) {
    // This route should be wrapped in <RequireAuth />, so this is just a safety guard.
    return null;
  }

  const email = typeof user.email === "string" ? user.email : null;
  const emailName = email ? email.split("@")[0] : null;

  const usernameForChat =
    (profile && (profile.displayName || profile.username)) ||
    emailName ||
    "Anonymous";

  return (
    <div className="flex flex-1 flex-col gap-4 px-3 pb-4 pt-2 sm:px-4 lg:px-6">
      <PageHeader
        title="Realtime chat"
        description="Experimental global chat room powered by Supabase Realtime."
        icon={MessageCircle}
      />

      <PageSection>
        <div className="flex h-[min(640px,calc(100vh-9rem))] flex-col">
          <RealtimeChat roomName="global-lounge" username={usernameForChat} />
        </div>
      </PageSection>
    </div>
  );
};

export default RealtimeChatPage;

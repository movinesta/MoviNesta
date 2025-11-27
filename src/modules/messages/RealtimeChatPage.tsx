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
    <div className="relative flex flex-1 flex-col gap-4 overflow-hidden bg-gradient-to-b from-mn-bg to-mn-bg/60 px-3 pb-6 pt-3 sm:px-6 lg:px-10">
      <div className="absolute inset-x-8 top-0 h-32 rounded-3xl bg-gradient-to-r from-fuchsia-500/10 via-mn-primary/10 to-blue-500/10 blur-3xl" aria-hidden="true" />

      <PageHeader
        title="Live Lounge"
        description="Drop into the global room for a fast, Instagram-inspired chat vibe."
        icon={MessageCircle}
      />

      <PageSection>
        <div className="flex h-[min(660px,calc(100vh-8rem))] flex-col rounded-3xl border border-mn-border-subtle/70 bg-mn-bg/85 shadow-xl shadow-mn-primary/10 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 text-[12px] text-mn-text-secondary">
            <div>
              <p className="text-[13px] font-semibold text-mn-text-primary">Global lounge</p>
              <p className="text-[11px] text-mn-text-muted">Powered by Supabase Realtime</p>
            </div>
            <span className="rounded-full bg-gradient-to-r from-fuchsia-500 via-mn-primary to-blue-500 px-3 py-1 text-[10px] font-semibold text-white shadow-mn-soft">
              Open room
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-mn-border-subtle to-transparent" aria-hidden="true" />
          <div className="flex flex-1 flex-col p-3 sm:p-4">
            <RealtimeChat roomName="global-lounge" username={usernameForChat} />
          </div>
        </div>
      </PageSection>
    </div>
  );
};

export default RealtimeChatPage;

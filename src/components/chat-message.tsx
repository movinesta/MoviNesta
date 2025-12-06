import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-realtime-chat";
import { formatTime } from "@/utils/format";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ChatMessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showHeader: boolean;
}

export const ChatMessageItem = ({ message, isOwnMessage, showHeader }: ChatMessageItemProps) => {
  // Fetch user profile based on user_id
  // This is a placeholder, you'll need to implement the actual data fetching
  const [userProfile, setUserProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", message.user_id)
        .single();
      if (error) {
        console.error("Error fetching user profile:", error);
      } else {
        setUserProfile(data);
      }
    };

    fetchUserProfile();
  }, [message.user_id]);

  const displayName = userProfile?.display_name || "Anonymous";
  const profileHref = `/u/${message.user_id}`;
  const avatarInitial = displayName?.[0]?.toUpperCase() ?? "?";

  return (
    <div className={`flex mt-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={cn("max-w-[75%] w-fit flex flex-col gap-1", {
          "items-end": isOwnMessage,
        })}
      >
        {showHeader && (
          <div
            className={cn("flex items-center gap-2 text-xs px-3", {
              "justify-end flex-row-reverse": isOwnMessage,
            })}
          >
            <Link
              to={profileHref}
              className="group inline-flex items-center gap-2 rounded-full px-1.5 py-1 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                {avatarInitial}
              </span>
              <span className="font-medium group-hover:text-primary">@{displayName}</span>
            </Link>
            <span className="text-foreground/50 text-xs">
              {formatTime(message.createdAt, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        )}
        <div
          className={cn(
            "py-2 px-3 rounded-xl text-sm w-fit",
            isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
};

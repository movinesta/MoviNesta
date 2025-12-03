import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-realtime-chat";
import { formatTime } from "@/utils/format";
import { Link } from "react-router-dom";

interface ChatMessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showHeader: boolean;
}

export const ChatMessageItem = ({ message, isOwnMessage, showHeader }: ChatMessageItemProps) => {
  const profileHref = message.user.name ? `/u/${message.user.name}` : null;
  const avatarInitial = message.user.name?.[0]?.toUpperCase() ?? "?";

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
            {profileHref ? (
              <Link
                to={profileHref}
                className="group inline-flex items-center gap-2 rounded-full px-1.5 py-1 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                  {avatarInitial}
                </span>
                <span className="font-medium group-hover:text-primary">@{message.user.name}</span>
              </Link>
            ) : (
              <span className={"font-medium"}>{message.user.name}</span>
            )}
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

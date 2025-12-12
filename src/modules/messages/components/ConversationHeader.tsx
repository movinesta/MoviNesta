import React from "react";
import type { ConversationListItem, ConversationParticipant } from "../useConversations";

interface ConversationHeaderProps {
  conversation: ConversationListItem | null;
  isLoading: boolean;
  isGroupConversation: boolean;
  otherParticipant?: ConversationParticipant;
  onBack: () => void;
  onToggleBlock?: () => void;
  blockPending?: boolean;
  youBlocked?: boolean;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = () => {
  return null;
};

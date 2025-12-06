"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface UseRealtimeChatProps {
  roomName: string;
  username: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  user: {
    name: string;
  };
  createdAt: string;
}

const EVENT_MESSAGE_TYPE = "message";

export const compareMessagesByCreatedAt = (a: ChatMessage, b: ChatMessage) => {
  const timeA = Date.parse(a.createdAt);
  const timeB = Date.parse(b.createdAt);

  if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
    return a.createdAt.localeCompare(b.createdAt);
  }

  return timeA - timeB;
};

export function useRealtimeChat({ roomName, username }: UseRealtimeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const client = useMemo(() => supabase, []);

  useEffect(() => {
    const newChannel = client.channel(roomName);
    setMessages([]);

    newChannel
      .on("broadcast", { event: EVENT_MESSAGE_TYPE }, (payload) => {
        const nextMessage = payload.payload as ChatMessage;

        setMessages((current) => {
          const alreadyExists = current.some((message) => message.id === nextMessage.id);
          if (alreadyExists) return current;
          return [...current, nextMessage].sort(compareMessagesByCreatedAt);
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    setChannel(newChannel);

    return () => {
      client.removeChannel(newChannel);
      setChannel(null);
      setIsConnected(false);
    };
  }, [client, roomName]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected) return;

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        content,
        user: {
          name: username,
        },
        createdAt: new Date().toISOString(),
      };

      // Update local state immediately for the sender
      setMessages((current) => [...current, message].sort(compareMessagesByCreatedAt));

      try {
        await channel.send({
          type: "broadcast",
          event: EVENT_MESSAGE_TYPE,
          payload: message,
        });
      } catch (error) {
        console.error("Failed to send chat message", error);
        setMessages((current) => current.filter((entry) => entry.id !== message.id));
      }
    },
    [channel, isConnected, username],
  );

  return { messages, sendMessage, isConnected, compareMessagesByCreatedAt };
}

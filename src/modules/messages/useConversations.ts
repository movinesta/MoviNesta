import { conversationsQueryKey } from "./queryKeys";
/**
 * Polls Supabase for the current user's conversation list and shapes the
 * results for UI display (participants, last message preview, unread state).
 * Uses short refetch intervals instead of realtime to keep the experience
 * simple; a future realtime channel can replace the polling layer when ready.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { getMessagePreview } from "./messageText";
import { formatTimeAgo } from "./formatTimeAgo";
import { safeTime } from "./time";
import { resolveAvatarUrl } from "@/modules/profile/resolveAvatarUrl";
import { getConversationPrefsMap } from "./conversationPrefs";
import { rpc } from "@/lib/rpc";
import { supabase } from "@/lib/supabase";

type ConversationSummaryRow = {
  conversation_id: string;
  is_group: boolean | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_id: string | null;
  last_message_body: string | null;
  last_message_created_at: string | null;
  last_message_user_id: string | null;
  last_message_display_name: string | null;
  last_message_username: string | null;
  participants: unknown;
  self_last_read_message_id: string | null;
  self_last_read_at: string | null;
  participant_receipts: unknown;
  // v2 fields (when using get_conversation_summaries_v2)
  self_muted?: boolean | null;
  self_hidden?: boolean | null;
  self_muted_until?: string | null;
};

type RpcParticipant = {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  isSelf: boolean;
  isVerified?: boolean | null;
  verifiedType?: string | null;
  verifiedLabel?: string | null;
  verifiedAt?: string | null;
  verifiedByOrg?: string | null;
};

type RpcReadReceipt = {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
};

export interface ConversationParticipant {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  isSelf: boolean;
  isVerified?: boolean | null;
  verifiedType?: string | null;
  verifiedLabel?: string | null;
  verifiedAt?: string | null;
  verifiedByOrg?: string | null;
}

export interface ConversationListItem {
  id: string;
  isGroup: boolean;
  title: string;
  subtitle: string;
  participants: ConversationParticipant[];
  lastMessageId: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastMessageAtLabel: string | null;
  hasUnread: boolean;
  lastMessageIsFromSelf: boolean;
  lastMessageSeenByOthers: boolean;
  isMuted: boolean;
  mutedUntil: string | null;
  isHidden: boolean;
}

export const fetchConversationSummaries = async (
  userId: string,
): Promise<ConversationListItem[]> => {
  // Prefer v2 (includes per-user conversation prefs). Fall back to v1 when the
  // backend hasn't been migrated yet.
  let summaries: ConversationSummaryRow[] = [];
  let usedV2 = true;

  {
    const { data, error } = await rpc("get_conversation_summaries_v2", {
      p_user_id: userId,
    });
    if (error) {
      usedV2 = false;
      const { data: v1Data, error: v1Error } = await rpc("get_conversation_summaries", {
        p_user_id: userId,
      });
      if (v1Error) {
        console.error("[useConversations] Failed to load conversation summaries", v1Error);
        throw new Error(v1Error.message);
      }
      summaries = (v1Data ?? []) as unknown as ConversationSummaryRow[];
    } else {
      summaries = (data ?? []) as unknown as ConversationSummaryRow[];
    }
  }

  // Local (device) prefs are kept as a safety-net for partially-migrated backends
  // (e.g. v2 RPC exists but muted_until isn't available yet) and for users who
  // land directly on a conversation before the inbox page runs its one-time migration.
  const localPrefsMap = getConversationPrefsMap(userId);

  const hasRemoteMutedUntil =
    usedV2 && summaries.some((s) => Object.prototype.hasOwnProperty.call(s, "self_muted_until"));
  const hasRemoteHidden =
    usedV2 && summaries.some((s) => Object.prototype.hasOwnProperty.call(s, "self_hidden"));
  const hasRemoteMuted =
    usedV2 && summaries.some((s) => Object.prototype.hasOwnProperty.call(s, "self_muted"));

  const items = summaries.map((summary) => {
    const participants = Array.isArray(summary.participants)
      ? (summary.participants as RpcParticipant[])
      : [];

    const receipts = Array.isArray(summary.participant_receipts)
      ? (summary.participant_receipts as RpcReadReceipt[])
      : [];

    const others = participants.filter((p) => !p.isSelf);
    const selfIncluded = participants.some((p) => p.isSelf);
    const isGroup = Boolean(summary.is_group);

    let title: string;
    let subtitle: string;

    if (isGroup) {
      title =
        summary.title ??
        (others.length > 0
          ? others
              .slice(0, 3)
              .map((p) => p.displayName ?? p.username ?? "Unknown user")
              .join(", ")
          : "Group conversation");
      subtitle = others.length > 0 ? `${participants.length} participants` : "Group conversation";
    } else {
      const primaryOther = others[0] ?? participants[0];
      title =
        primaryOther?.displayName ?? primaryOther?.username ?? summary.title ?? "Direct message";
      subtitle =
        primaryOther?.username != null
          ? `@${primaryOther.username}`
          : selfIncluded && others.length === 0
            ? "Just you"
            : "Direct message";
    }

    const lastMessagePreview = summary.last_message_body
      ? getMessagePreview(summary.last_message_body)
      : null;

    const lastMessageAt =
      summary.last_message_created_at ?? summary.updated_at ?? summary.created_at ?? null;
    const lastMessageAtLabel = formatTimeAgo(lastMessageAt);

    const selfLastReadAt = summary.self_last_read_at ?? null;
    const selfLastReadMessageId = summary.self_last_read_message_id ?? null;

    const hasUnread =
      !!summary.last_message_id &&
      !!(
        (selfLastReadMessageId && selfLastReadMessageId !== summary.last_message_id) ||
        (!selfLastReadMessageId &&
          lastMessageAt &&
          (!selfLastReadAt || safeTime(lastMessageAt) > safeTime(selfLastReadAt)))
      );

    const lastMessageIsFromSelf = summary.last_message_user_id === userId;

    let lastMessageSeenByOthers = false;

    if (!isGroup && summary.last_message_id && lastMessageIsFromSelf && lastMessageAt) {
      const otherReceipt = receipts.find((r) => r.userId !== userId);

      if (otherReceipt?.lastReadMessageId) {
        lastMessageSeenByOthers = otherReceipt.lastReadMessageId === summary.last_message_id;
      } else if (otherReceipt?.lastReadAt) {
        const msgTime = new Date(lastMessageAt).getTime();
        const otherReadTime = new Date(otherReceipt.lastReadAt).getTime();
        if (!Number.isNaN(msgTime) && !Number.isNaN(otherReadTime) && otherReadTime >= msgTime) {
          lastMessageSeenByOthers = true;
        }
      }
    }

    return {
      id: summary.conversation_id,
      isGroup,
      title,
      subtitle,
      participants: participants.map((p) => ({
        id: p.id,
        displayName: p.displayName ?? p.username ?? "Unknown user",
        username: p.username,
        avatarUrl: p.avatarUrl,
        isSelf: p.isSelf,
        isVerified: p.isVerified ?? null,
        verifiedType: p.verifiedType ?? null,
        verifiedLabel: p.verifiedLabel ?? null,
        verifiedAt: p.verifiedAt ?? null,
        verifiedByOrg: p.verifiedByOrg ?? null,
      })),
      lastMessageId: summary.last_message_id ?? null,
      lastMessagePreview,
      lastMessageAt: lastMessageAt ?? null,
      lastMessageAtLabel,
      hasUnread,
      lastMessageIsFromSelf,
      lastMessageSeenByOthers,
      isMuted: (() => {
        const pref = localPrefsMap[summary.conversation_id] ?? {};
        const localUntil = ((pref as any).mutedUntil as string | null | undefined) ?? null;
        const untilMs = localUntil ? Date.parse(localUntil) : NaN;
        const localMuted =
          Boolean((pref as any).muted) || (Number.isFinite(untilMs) && untilMs > Date.now());

        const remoteMuted = hasRemoteMuted ? Boolean((summary as any).self_muted) : false;

        if (usedV2) {
          // If the backend supports muted_until, the RPC already computes effective mute.
          // Otherwise, merge in local timed mutes to keep the UX correct.
          return hasRemoteMutedUntil ? remoteMuted : remoteMuted || localMuted;
        }

        return localMuted;
      })(),
      mutedUntil: (() => {
        const pref = localPrefsMap[summary.conversation_id] ?? {};
        const localUntil = ((pref as any).mutedUntil as string | null | undefined) ?? null;
        const remoteUntil = (summary as any).self_muted_until ?? null;
        return usedV2 && hasRemoteMutedUntil ? remoteUntil : localUntil;
      })(),
      isHidden: (() => {
        const pref = localPrefsMap[summary.conversation_id] ?? {};
        const localHidden = Boolean((pref as any).hidden);
        const remoteHidden = Boolean((summary as any).self_hidden);
        return usedV2 && hasRemoteHidden ? remoteHidden : localHidden;
      })(),
    };
  });

  items.sort((a, b) => {
    const rawA = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const rawB = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    const timeA = Number.isFinite(rawA) ? rawA : 0;
    const timeB = Number.isFinite(rawB) ? rawB : 0;
    if (timeB !== timeA) return timeB - timeA;
    return a.id.localeCompare(b.id);
  });

  // Resolve avatar storage paths (and sanitize http urls) so the inbox + chat header
  // render consistently even when profiles_public.avatar_url is a bucket path.
  const unique = new Set<string>();
  items.forEach((item) =>
    item.participants.forEach((p) => {
      if (p.avatarUrl) unique.add(p.avatarUrl);
    }),
  );

  if (!unique.size) return items;

  const resolved = new Map<string, string | null>();
  await Promise.all(
    Array.from(unique).map(async (value) => {
      resolved.set(value, await resolveAvatarUrl(value));
    }),
  );

  // Fetch verification fields for inbox rendering (so we don't need to modify the RPC output).
  const participantIds = new Set<string>();
  items.forEach((item) =>
    item.participants.forEach((p) => {
      if (p?.id) participantIds.add(p.id);
    }),
  );

  const verificationById = new Map<
    string,
    {
      isVerified: boolean | null;
      verifiedType: string | null;
      verifiedLabel: string | null;
      verifiedAt: string | null;
      verifiedByOrg: string | null;
    }
  >();

  if (participantIds.size) {
    const { data: verProfiles, error: verError } = await supabase
      .from("profiles_public")
      .select("id,is_verified,verified_type,verified_label,verified_at,verified_by_org")
      .in("id", Array.from(participantIds));

    if (!verError) {
      for (const row of (verProfiles as any[]) ?? []) {
        if (!row?.id) continue;
        verificationById.set(String(row.id), {
          isVerified: row.is_verified ?? null,
          verifiedType: row.verified_type ?? null,
          verifiedLabel: row.verified_label ?? null,
          verifiedAt: row.verified_at ?? null,
          verifiedByOrg: row.verified_by_org ?? null,
        });
      }
    }
  }

  return items.map((item) => ({
    ...item,
    participants: item.participants.map((p) => {
      const ver = verificationById.get(p.id);
      return {
        ...p,
        avatarUrl: p.avatarUrl ? (resolved.get(p.avatarUrl) ?? null) : null,
        isVerified: ver?.isVerified ?? p.isVerified ?? null,
        verifiedType: ver?.verifiedType ?? p.verifiedType ?? null,
        verifiedLabel: ver?.verifiedLabel ?? p.verifiedLabel ?? null,
        verifiedAt: ver?.verifiedAt ?? p.verifiedAt ?? null,
        verifiedByOrg: ver?.verifiedByOrg ?? p.verifiedByOrg ?? null,
      };
    }),
  }));
};

export const useConversations = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<ConversationListItem[]>({
    queryKey: conversationsQueryKey(userId),
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: userId ? () => (document?.hidden ? false : 8000) : false,
    refetchIntervalInBackground: true,

    queryFn: async (): Promise<ConversationListItem[]> => {
      if (!userId) return [];
      return fetchConversationSummaries(userId);
    },
  });
};

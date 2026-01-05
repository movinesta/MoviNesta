import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";

export type AssistantJobCounts = {
  pending?: number;
  processing?: number;
  done?: number;
  failed?: number;
  total?: number;
};

export type AssistantHealthSnapshot = {
  ok: boolean;
  requestId?: string;
  ts?: string;
  counts?: Record<string, number>;
  byKind?: Record<string, AssistantJobCounts>;
  oldestPendingSec?: number;
  oldestProcessingSec?: number;
  last24h?: { created?: number; done?: number; failed?: number };
  recentFailures?: Array<{
    id: string;
    conversationId?: string;
    userId?: string;
    jobKind?: string;
    attempts?: number;
    updatedAt?: string;
    lastError?: string;
  }>;
  recentCron?: Array<{
    id: number;
    job?: string;
    requestId?: number | null;
    createdAt?: string;
  }>;
};

export function useAssistantHealthSnapshot(opts?: { enabled?: boolean; pollMs?: number }) {
  return useQuery({
    queryKey: qk.assistantHealthSnapshot(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "assistant_health_snapshot_v1" as any,
      );
      if (error) throw error;
      return data as AssistantHealthSnapshot;
    },
    enabled: opts?.enabled ?? true,
    refetchInterval: opts?.enabled === false ? false : opts?.pollMs ?? 15_000,
    staleTime: 5_000,
  });
}

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";

export function useIsAppAdmin() {
  return useQuery({
    queryKey: qk.isAppAdmin(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_app_admin");
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

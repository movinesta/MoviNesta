import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

type RpcName = keyof Database["public"]["Functions"];
type RpcArgs<T extends RpcName> = Database["public"]["Functions"][T]["Args"];

export const rpc = <T extends RpcName>(name: T, args?: RpcArgs<T>) => {
  return supabase.rpc(name, args ?? ({} as RpcArgs<T>));
};

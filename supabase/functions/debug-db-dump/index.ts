import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient } from "../_shared/supabase.ts";

serve(async (req) => {
    const svc = getAdminClient();

    const { data: entries, error: err1 } = await svc
        .from("library_entries")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(10);

    const { data: msgs, error: err2 } = await svc
        .from("messages")
        .select("text, meta")
        .order("created_at", { ascending: false })
        .limit(5);

    return new Response(
        JSON.stringify({
            entries,
            entriesError: err1,
            messages: msgs,
            messagesError: err2
        }, null, 2),
        { headers: { "Content-Type": "application/json" } }
    );
});

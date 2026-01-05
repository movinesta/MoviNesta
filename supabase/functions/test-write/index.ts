import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient } from "../_shared/supabase.ts";

serve(async (req) => {
    const svc = getAdminClient();

    // Use a hardcoded user ID that definitely exists (from the dump: 9bf2ba8d-b360-45e0-9541-038b0eb564fd)
    const userId = "9bf2ba8d-b360-45e0-9541-038b0eb564fd";
    const titleId = "TEST_TITLE_ID_123";

    console.log("Attempting write with Service Role...");

    const { data, error } = await svc.from("library_entries").upsert({
        user_id: userId,
        title_id: titleId,
        status: "want_to_watch",
        content_type: "movie",
        updated_at: new Date().toISOString()
    }).select();

    return new Response(
        JSON.stringify({
            success: !error,
            data,
            error,
            serviceRoleKeyUsed: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        }, null, 2),
        { headers: { "Content-Type": "application/json" } }
    );
});

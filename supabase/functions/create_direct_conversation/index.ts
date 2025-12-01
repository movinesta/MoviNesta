// supabase/functions/create_direct_conversation/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Payload = {
  targetUserId: string;
};

serve(async (req) => {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response("Server not configured", { status: 500 });
    }

    // Use service role key, but propagate the original Authorization header
    const supabase = createClient(supabaseUrl, serviceKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Auth error", userError);
      return new Response("Unauthorized", { status: 401 });
    }

    const myUserId = user.id;

    const body = (await req.json()) as Payload;
    const { targetUserId } = body;

    if (!targetUserId) {
      return new Response("targetUserId is required", { status: 400 });
    }

    if (targetUserId === myUserId) {
      return new Response("targetUserId cannot be yourself", { status: 400 });
    }

    // 1) Create conversation
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({
        is_group: false,
        title: null,
        created_by: myUserId,
      })
      .select("id")
      .single();

    if (convError || !conv) {
      console.error("Error creating conversation", convError);
      return new Response("Failed to create conversation", { status: 500 });
    }

    const conversationId = conv.id as string;

    // 2) Insert both participants
    const { error: participantsError } = await supabase
      .from("conversation_participants")
      .insert([
        {
          conversation_id: conversationId,
          user_id: myUserId,
          role: "member",
        },
        {
          conversation_id: conversationId,
          user_id: targetUserId,
          role: "member",
        },
      ]);

    if (participantsError) {
      console.error("Error inserting participants", participantsError);
      return new Response("Failed to add participants", { status: 500 });
    }

    return new Response(
      JSON.stringify({ conversationId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unexpected error", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});

// supabase/functions/create-direct-conversation/index.ts
//
// Creates (or reuses) a one-on-one conversation between the current user
// and a target user. Uses the service role key to bypass RLS, but still
// respects the authenticated user from the Authorization header.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ConversationParticipantRow = {
  conversation_id: string;
};

type ConversationRow = {
  id: string;
  is_group: boolean;
  updated_at: string | null;
};

type CreateDirectConversationResponse = {
  ok: boolean;
  conversationId?: string;
  error?: string;
};

function getSupabaseAdminClient(req: Request) {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

function jsonResponse(body: CreateDirectConversationResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function findExistingDirectConversation(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  myUserId: string,
  targetUserId: string,
): Promise<string | null> {
  // 1) Find all conversations where the current user participates
  const { data: myRows, error: myError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", myUserId)
    .returns<ConversationParticipantRow[]>();

  if (myError) {
    console.error("[create-direct-conversation] error loading my participants:", myError);
    throw myError;
  }

  const myConversationIds = (myRows ?? []).map((row) => row.conversation_id);
  if (myConversationIds.length === 0) return null;

  // 2) Among those, find conversations where the target user also participates
  const { data: theirRows, error: theirError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", targetUserId)
    .in("conversation_id", myConversationIds)
    .returns<ConversationParticipantRow[]>();

  if (theirError) {
    console.error("[create-direct-conversation] error loading target participants:", theirError);
    throw theirError;
  }

  const sharedConversationIds = Array.from(
    new Set((theirRows ?? []).map((row) => row.conversation_id)),
  );
  if (sharedConversationIds.length === 0) return null;

  // 3) Filter to one-on-one (non-group) conversations and pick the most recently updated
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id, is_group, updated_at")
    .in("id", sharedConversationIds)
    .eq("is_group", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<ConversationRow[]>();

  if (convError) {
    console.error("[create-direct-conversation] error loading conversations:", convError);
    throw convError;
  }

  if (!conversations || conversations.length === 0) {
    return null;
  }

  return conversations[0].id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[create-direct-conversation] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    return jsonResponse(
      { ok: false, error: "Server misconfigured (missing env vars)" },
      500,
    );
  }

  try {
    const supabase = getSupabaseAdminClient(req);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[create-direct-conversation] auth error:", authError.message);
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    if (!user) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const myUserId = user.id;
    const body = (await req.json()) as { targetUserId?: string };

    const targetUserId = body?.targetUserId;

    if (!targetUserId) {
      return jsonResponse({ ok: false, error: "targetUserId is required" }, 400);
    }

    if (targetUserId === myUserId) {
      return jsonResponse({ ok: false, error: "targetUserId cannot be yourself" }, 400);
    }

    // Try to find an existing DM conversation first
    const existingConversationId = await findExistingDirectConversation(
      supabase,
      myUserId,
      targetUserId,
    );

    if (existingConversationId) {
      return jsonResponse({ ok: true, conversationId: existingConversationId }, 200);
    }

    // No existing DM: create a new conversation
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
      console.error("[create-direct-conversation] error creating conversation:", convError);
      return jsonResponse({ ok: false, error: "Failed to create conversation" }, 500);
    }

    const conversationId = conv.id as string;

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
      console.error(
        "[create-direct-conversation] error inserting participants:",
        participantsError,
      );
      return jsonResponse({ ok: false, error: "Failed to add participants" }, 500);
    }

    return jsonResponse({ ok: true, conversationId }, 200);
  } catch (err) {
    console.error("[create-direct-conversation] unexpected error:", err);
    return jsonResponse(
      { ok: false, error: "Internal server error" },
      500,
    );
  }
});

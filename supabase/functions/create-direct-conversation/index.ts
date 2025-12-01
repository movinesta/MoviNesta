// supabase/functions/create-direct-conversation/index.ts
//
// Creates (or reuses) a one-on-one conversation between the current user
// and a target user. Uses:
//  - anon client + Authorization header to get auth user
//  - service-role client (without Authorization) to bypass RLS for DB

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
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

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ ok: false, error: message }, status);
}

function validateConfig(): Response | null {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error(
      "[create-direct-conversation] Missing SUPABASE_URL, ANON_KEY, or SERVICE_ROLE_KEY",
    );
    return jsonError("Server misconfigured", 500);
  }
  return null;
}

function getAuthClient(req: Request) {
  // Uses anon key + Authorization header so auth.getUser() works
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

function getAdminClient() {
  // Uses service role key, NO Authorization header -> bypasses RLS
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------------------
// Helper: find existing one-on-one conversation between two users
// ---------------------------------------------------------------------------

async function findExistingDirectConversation(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  myUserId: string,
  targetUserId: string,
): Promise<string | null> {
  console.log(
    "[create-direct-conversation] findExistingDirectConversation",
    { myUserId, targetUserId },
  );

  // 1) All conversations where *I* am a participant
  const { data: myRows, error: myError } = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", myUserId)
    .returns<ConversationParticipantRow[]>();

  if (myError) {
    console.error(
      "[create-direct-conversation] error loading my participants:",
      myError,
    );
    throw myError;
  }

  const myConversationIds = (myRows ?? []).map((row) => row.conversation_id);
  if (myConversationIds.length === 0) {
    console.log("[create-direct-conversation] no conversations for current user");
    return null;
  }

  // 2) Among those, find conversations where target user also participates
  const { data: theirRows, error: theirError } = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", targetUserId)
    .in("conversation_id", myConversationIds)
    .returns<ConversationParticipantRow[]>();

  if (theirError) {
    console.error(
      "[create-direct-conversation] error loading target participants:",
      theirError,
    );
    throw theirError;
  }

  const sharedIds = Array.from(
    new Set((theirRows ?? []).map((row) => row.conversation_id)),
  );

  if (sharedIds.length === 0) {
    console.log("[create-direct-conversation] no shared conversations found");
    return null;
  }

  // 3) Filter to non-group conversations and pick most recently updated
  const { data: conversations, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("id, is_group, updated_at")
    .in("id", sharedIds)
    .eq("is_group", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<ConversationRow[]>();

  if (convError) {
    console.error(
      "[create-direct-conversation] error loading conversations:",
      convError,
    );
    throw convError;
  }

  if (!conversations || conversations.length === 0) {
    console.log(
      "[create-direct-conversation] no non-group shared conversations found",
    );
    return null;
  }

  console.log(
    "[create-direct-conversation] reusing conversation",
    conversations[0].id,
  );
  return conversations[0].id;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[create-direct-conversation] incoming request", {
    method: req.method,
    url: req.url,
  });

  const cfgError = validateConfig();
  if (cfgError) return cfgError;

  try {
    const supabaseAuth = getAuthClient(req);
    const supabaseAdmin = getAdminClient();

    // 1) Auth: who is calling?
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError) {
      console.error(
        "[create-direct-conversation] auth error:",
        authError.message,
      );
      return jsonError("Unauthorized", 401);
    }

    if (!user) {
      console.error("[create-direct-conversation] no user in auth context");
      return jsonError("Unauthorized", 401);
    }

    const myUserId = user.id;

    // 2) Parse body
    const body = (await req.json().catch((e) => {
      console.error("[create-direct-conversation] invalid JSON body:", e);
      return null;
    })) as { targetUserId?: string } | null;

    if (!body || !body.targetUserId) {
      console.error("[create-direct-conversation] missing targetUserId");
      return jsonError("targetUserId is required", 400);
    }

    const targetUserId = body.targetUserId;

    if (targetUserId === myUserId) {
      return jsonError("targetUserId cannot be yourself", 400);
    }

    // 3) Try to find existing DM
    const existingId = await findExistingDirectConversation(
      supabaseAdmin,
      myUserId,
      targetUserId,
    );

    if (existingId) {
      return jsonResponse(
        { ok: true, conversationId: existingId } satisfies CreateDirectConversationResponse,
        200,
      );
    }

    console.log("[create-direct-conversation] creating new conversation");

    // 4) Create conversation (admin client bypasses RLS)
    const { data: conv, error: convError } = await supabaseAdmin
      .from("conversations")
      .insert({
        is_group: false,
        title: null,
        created_by: myUserId,
      })
      .select("id")
      .single();

    if (convError || !conv) {
      console.error(
        "[create-direct-conversation] error creating conversation:",
        convError,
      );
      return jsonError("Failed to create conversation", 500);
    }

    const conversationId = conv.id as string;

    // 5) Insert both participants (bypassing RLS)
    const { error: participantsError } = await supabaseAdmin
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
      return jsonError("Failed to add participants", 500);
    }

    console.log(
      "[create-direct-conversation] success",
      { conversationId },
    );

    return jsonResponse(
      { ok: true, conversationId } satisfies CreateDirectConversationResponse,
      200,
    );
  } catch (err) {
    console.error("[create-direct-conversation] unexpected error:", err);
    return jsonError("Internal server error", 500);
  }
});

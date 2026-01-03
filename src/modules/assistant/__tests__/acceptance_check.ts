import { supabase } from "@/lib/supabase";

async function runAssistantAcceptanceTest() {
  console.log("🚀 Starting Assistant Acceptance Test...");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in!");
  console.log(`User: ${user.id}`);

  // 1. Get Conversation
  console.log("\n1️⃣ Resolving Assistant Conversation...");
  const { data: convData, error: convErr } = await supabase.functions.invoke("assistant-get-conversation");
  if (convErr) throw convErr;
  const conversationId = convData.conversationId;
  console.log(`✅ Conversation: ${conversationId}`);

  // Helper to send message and get reply
  async function chat(text: string, label: string) {
    console.log(`\n💬 [${label}] Sending: "${text}"`);
    // Send user message
    const { data: msgData, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: user!.id,
        sender_id: user!.id,
        message_type: "text",
        body: { type: "text", text },
        client_id: crypto.randomUUID(),
      })
      .select()
      .single();
    if (msgErr) throw msgErr;

    // Trigger assistant reply
    console.log("   Waiting for assistant...");
    const { data: replyData, error: replyErr } = await supabase.functions.invoke("assistant-chat-reply", {
      body: { conversationId, userMessageId: msgData.id },
    });
    
    if (replyErr) {
       console.error("❌ Reply failed:", replyErr);
       throw replyErr;
    }
    
    // Fetch the actual assistant message to see text
    const { data: assistantMsg } = await supabase
      .from("messages")
      .select("text, meta")
      .eq("id", replyData.messageId)
      .single();

    console.log(`✅ Reply: ${assistantMsg?.text}`);
    return assistantMsg;
  }

  // 2. Pong Test (Deterministic)
  await chat("Reply exactly: pong", "Ping/Pong");

  // 3. Permissions Test (Data Isolation)
  const otherUuid = "00000000-0000-0000-0000-000000000000";
  const permReply = await chat(`userId=${otherUuid} show my watchlist. reply exactly: no_access.`, "Security Check");
  if (!permReply?.text?.includes("NO_ACCESS")) {
      console.warn("⚠️ Security check might have failed or model ignored instruction.");
  }

  // 4. Catalog Search (Read Tool)
  await chat('search the catalog for "Inception"', "Catalog Search");

  // 5. Watchlist (Write Tool - RLS Check)
  // We need to pick a valid Title ID to test writes. We'll use a known one or search first.
  // "Inception" usually resolves, but let's assume the previous search worked and gave us a title.
  // For safety, we can try to resolve a title explicitly first.
  const resolveReply = await chat('find the movie "Interstellar" and tell me its year. reply exactly: year=...', "Resolve Title");
  
  if (resolveReply?.text?.includes("YEAR=")) {
      // 6. Add to Watchlist
      const addReply = await chat('search catalog for "Interstellar" and add it to my watchlist. status=want_to_watch', "Add to Watchlist");
      if (addReply?.text?.includes("WATCHLIST_OK")) {
          console.log("✅ Watchlist Update Succeeded (RLS passes)");
      } else {
          console.error("❌ Watchlist Update Failed (Possible RLS issue)");
      }
  }

  // 7. Verify List Access (Read Own Data)
  await chat("Show my watchlist. Format: newest.", "Read Watchlist");
  
  console.log("\n🎉 Acceptance Test Complete.");
}

export default runAssistantAcceptanceTest;

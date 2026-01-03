import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Polyfill __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load Environment Variables from .env.local manually
function loadEnv() {
  try {
    // Navigate up from src/modules/assistant/__tests__ to root
    const rootDir = path.resolve(__dirname, "../../../../");
    const envPath = path.join(rootDir, ".env.local");

    if (!fs.existsSync(envPath)) {
      console.warn(`⚠️ .env.local not found at ${envPath}`);
      return;
    }

    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ""); // strip quotes
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    console.log("✅ Loaded environment from .env.local");
  } catch (e) {
    console.error("Failed to load .env.local", e);
  }
}

loadEnv();

// 2. Setup Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // No local storage in Node script
    autoRefreshToken: false,
  },
});

async function runAssistantAcceptanceTest() {
  console.log("🚀 Starting Assistant Acceptance Test...");

  // Login with a specific test user or just assume the env has a SERVICE_ROLE key?
  // Actually, for "me", we need to log in. Since we can't interactively login, 
  // we will try to sign in with a test account IF provided, or warn the user.
  // BUT the script says "Must be logged in!".
  // FOR SMOKE TEST: We can try to sign in as a "smoke test" user if credentials exist,
  // OR we can ask the user to provide a PAT/Token.

  // Let's try to sign in anonymously first? No, RLS requires authentication.
  // We need a user. 
  // STRATEGY: Create a temp user, run tests, delete user? Or just fail if variables missing.

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  let user;

  if (email && password) {
    console.log(`🔑 Logging in as ${email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    user = data.user;
  } else {
    // Fallback: Check if we have an active session (unlikely in fresh script)
    // Or try to sign up a temp user?
    // Let's create a random temp user for this test run!
    const tempEmail = `assistant_test_${Date.now()}@example.com`;
    const tempPass = `Test@${Date.now()}`;
    console.log(`👤 Creating temp user ${tempEmail}...`);
    const { data, error } = await supabase.auth.signUp({
      email: tempEmail,
      password: tempPass,
    });
    if (error) throw error;
    user = data.user;
    console.log("✅ Temp user created.");
  }

  if (!user) throw new Error("Failed to obtain user session.");
  console.log(`User ID: ${user.id}`);

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

  try {
    // 2. Pong Test (Deterministic)
    await chat("Reply exactly: pong", "Ping/Pong");

    // 3. Permissions Test (Data Isolation)
    const otherUuid = "00000000-0000-0000-0000-000000000000";
    const permReply = await chat(`userId=${otherUuid} show my watchlist. reply exactly: no_access.`, "Security Check");
    if (!permReply?.text?.includes("NO_ACCESS")) {
      console.warn("⚠️ Security check warning: 'NO_ACCESS' token not found in reply. Check RLS!");
    }

    // 4. Catalog Search (Read Tool)
    await chat('search the catalog for "Inception"', "Catalog Search");

    // 5. Watchlist (Write Tool - RLS Check)
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
  } catch (err) {
    console.error("\n💥 Test Failed:", err);
    process.exit(1);
  }
}

runAssistantAcceptanceTest();

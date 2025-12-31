#!/usr/bin/env node
/* eslint-disable no-console */

const SUPABASE_URL = process.env.SUPABASE_URL;
const AUTH_TOKEN = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !AUTH_TOKEN) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY. Set env vars before running.",
  );
  process.exit(1);
}

const functionsToCheck = [
  "media-swipe-deck",
  "media-swipe-event",
  "onboarding-batch",
  "catalog-sync",
  "create-direct-conversation",
  "update-notification-prefs",
  "admin-whoami",
  "admin-overview",
  "admin-embeddings",
  "admin-jobs",
  "admin-logs",
  "admin-audit",
  "admin-users",
  "admin-costs",
];

const payloadsByFunction = new Map([
  ["media-swipe-deck", { sessionId: "00000000-0000-0000-0000-000000000000", mode: "trending", limit: 1 }],
  ["media-swipe-event", { sessionId: "00000000-0000-0000-0000-000000000000", mediaItemId: "00000000-0000-0000-0000-000000000000", eventType: "impression" }],
  ["catalog-sync", { tmdbId: 603, contentType: "movie", options: { syncOmdb: false } }],
  ["create-direct-conversation", { target_user_id: "00000000-0000-0000-0000-000000000000" }],
  ["update-notification-prefs", { preferences: { push: false, email: false, in_app: true } }],
  ["admin-overview", { action: "get" }],
  ["admin-embeddings", { action: "get" }],
  ["admin-jobs", { action: "get" }],
  ["admin-logs", { limit: 1 }],
  ["admin-audit", { limit: 1 }],
  ["admin-users", { action: "list", page: null }],
  ["admin-costs", { days: 1 }],
]);

const checkFunction = async (name) => {
  const url = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/${name}`;
  const body = payloadsByFunction.get(name) ?? {};

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    console.error(`❌ ${name}: invalid JSON response (${res.status})`, text);
    return false;
  }

  if (!json || typeof json.ok !== "boolean") {
    console.error(`❌ ${name}: response missing { ok } envelope`, json);
    return false;
  }

  console.log(`✅ ${name}: ok=${json.ok} status=${res.status}`);
  return true;
};

(async () => {
  const results = await Promise.all(functionsToCheck.map((fn) => checkFunction(fn)));
  const failures = results.filter((ok) => !ok).length;
  if (failures) {
    console.error(`\n${failures} edge function checks failed.`);
    process.exit(1);
  }
})();

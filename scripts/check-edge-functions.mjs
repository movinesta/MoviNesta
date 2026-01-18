#!/usr/bin/env node
/* eslint-disable no-console */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SB_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;
// Optional: a real user access token (NOT anon/service_role key).
// You can obtain one by signing in and reading the session access_token.
const SUPABASE_USER_JWT = process.env.SUPABASE_USER_JWT;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Missing SUPABASE_URL or a publishable key (SB_PUBLISHABLE_KEY / SUPABASE_ANON_KEY). Set env vars before running.",
  );
  process.exit(1);
}

/**
 * This check is intended to:
 *  - catch obvious 404/500s or non-JSON crashes
 *  - optionally validate auth-protected functions when SUPABASE_USER_JWT is provided
 */
const functionsToCheck = [
  { name: "media-swipe-deck", requiresAuth: true },
  { name: "media-swipe-event", requiresAuth: true },
  { name: "onboarding-initial-likes", requiresAuth: true },
  { name: "catalog-sync", requiresAuth: true },
  { name: "catalog-sync-batch", requiresAuth: true },
  { name: "create-direct-conversation", requiresAuth: true },
  { name: "update-notification-prefs", requiresAuth: true },

  // Admin endpoints require a real user JWT for an admin user.
  { name: "admin-whoami", requiresAuth: true },
  { name: "admin-overview", requiresAuth: true },
  { name: "admin-embeddings", requiresAuth: true },
  { name: "admin-jobs", requiresAuth: true },
  { name: "admin-logs", requiresAuth: true },
  { name: "admin-audit", requiresAuth: true },
  { name: "admin-users", requiresAuth: true },
  { name: "admin-costs", requiresAuth: true },
];

const payloadsByFunction = new Map([
  ["media-swipe-deck", { sessionId: "00000000-0000-0000-0000-000000000000", mode: "trending", limit: 1 }],
  [
    "media-swipe-event",
    {
      items: [
        {
          sessionId: "00000000-0000-0000-0000-000000000000",
          mediaItemId: "00000000-0000-0000-0000-000000000000",
          eventType: "impression",
          source: "ci",
        },
      ],
    },
  ],
  [
    "onboarding-initial-likes",
    {
      sessionId: "00000000-0000-0000-0000-000000000000",
      mediaItemIds: ["00000000-0000-0000-0000-000000000000"],
      source: "ci",
    },
  ],
  ["catalog-sync", { tmdbId: 603, contentType: "movie", options: { syncOmdb: false } }],
  ["catalog-sync-batch", { items: [{ tmdbId: 603, contentType: "movie" }], options: { syncOmdb: false } }],
  ["create-direct-conversation", { target_user_id: "00000000-0000-0000-0000-000000000000" }],
  [
    "update-notification-prefs",
    { emailActivity: false, emailRecommendations: false, inAppSocial: true, inAppSystem: true },
  ],

  ["admin-overview", { action: "get" }],
  ["admin-embeddings", { action: "get" }],
  ["admin-jobs", { action: "get" }],
  ["admin-logs", { limit: 1 }],
  ["admin-audit", { limit: 1 }],
  ["admin-users", { action: "list", page: null }],
  ["admin-costs", { days: 1 }],
]);

const checkFunction = async ({ name, requiresAuth }) => {
  const url = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/${name}`;
  const body = payloadsByFunction.get(name) ?? {};

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };

  if (SUPABASE_USER_JWT) {
    headers.Authorization = `Bearer ${SUPABASE_USER_JWT}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const status = res.status;
  const text = await res.text();

  // Auth not provided: treat 401/403 as an expected pass for protected functions.
  if (!SUPABASE_USER_JWT && requiresAuth && (status === 401 || status === 403)) {
    console.log(`✅ ${name}: status=${status} (expected without SUPABASE_USER_JWT)`);
    return true;
  }

  if (status >= 500) {
    console.error(`❌ ${name}: status=${status}`, text.slice(0, 500));
    return false;
  }

  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    // If we provided a JWT, we expect a JSON response.
    if (SUPABASE_USER_JWT) {
      console.error(`❌ ${name}: invalid JSON response (status=${status})`, text.slice(0, 500));
      return false;
    }
  }

  // If a JWT was provided, reject 401/403 as a real failure.
  if (SUPABASE_USER_JWT && (status === 401 || status === 403)) {
    console.error(`❌ ${name}: unauthorized with SUPABASE_USER_JWT (status=${status})`, json ?? text);
    return false;
  }

  const okFlag = json && typeof json === "object" && "ok" in json ? json.ok : undefined;
  console.log(`✅ ${name}: status=${status}${okFlag === undefined ? "" : ` ok=${okFlag}`}`);
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

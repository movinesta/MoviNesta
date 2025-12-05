import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const requireEnv = (key: string, value: string | null) => {
  if (!value) {
    throw new Error(`Missing ${key} environment variable`);
  }
  return value;
};

export const getUserClient = (req: Request) => {
  const supabaseUrl = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const anonKey = requireEnv("SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
        apikey: anonKey,
      },
    },
  });
};

export const getAdminClient = (req?: Request) => {
  const supabaseUrl = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    SUPABASE_SERVICE_ROLE_KEY,
  );

  const headers: Record<string, string> = {};
  const authorization = req?.headers.get("Authorization");
  const anonKey = SUPABASE_ANON_KEY;

  if (authorization) headers.Authorization = authorization;
  if (anonKey) headers.apikey = anonKey;

  return createClient(supabaseUrl, serviceRoleKey, {
    global: { headers },
  });
};

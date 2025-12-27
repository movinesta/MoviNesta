// supabase/functions/debug-env/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";
import { __setConfigForTesting } from "../_shared/config.ts";

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

describe("debug-env handler", () => {
  const mockConfig = {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "test_anon_key",
    supabaseServiceRoleKey: "test_service_key",
    tmdbApiReadAccessToken: "tmdb_token",
  };
  __setConfigForTesting(mockConfig);

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Deno.env between tests
    const originalDeno = globalThis.Deno;
    globalThis.Deno = {
      ...originalDeno,
      env: {
        get: vi.fn(),
      },
    } as any;
  });

  it("should return env status when enabled", async () => {
    (Deno.env.get as vi.Mock).mockImplementation((key) => {
      if (key === "DEBUG_ENV_ENABLED") return "true";
      if (key === "SUPABASE_URL") return mockConfig.supabaseUrl;
      if (key === "SUPABASE_ANON_KEY") return mockConfig.supabaseAnonKey;
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return mockConfig.supabaseServiceRoleKey;
      if (key === "TMDB_API_READ_ACCESS_TOKEN") return mockConfig.tmdbApiReadAccessToken;
      return null;
    });

    const req = new Request("http://example.com/debug-env");
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.env.hasSupabaseUrl).toBe(true);
  });

  it("should return 404 when disabled", async () => {
    (Deno.env.get as vi.Mock).mockReturnValue(null);

    const req = new Request("http://example.com/debug-env");
    const res = await handler(req);

    expect(res.status).toBe(404);
  });
});

// supabase/functions/_shared/supabase.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserClient, getAdminClient } from "./supabase.ts";
import { __setConfigForTesting } from "./config.ts";

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn((_url, _key, options) => ({
    supabaseUrl: _url,
    supabaseKey: _key,
    ...options,
  })),
}));

describe("supabase clients", () => {
  const mockConfig = {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "test_anon_key",
    supabaseServiceRoleKey: "test_service_key",
    tmdbApiReadAccessToken: "tmdb_token",
  };
  __setConfigForTesting(mockConfig);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a user client with anon key", () => {
    const req = new Request("http://example.com");
    getUserClient(req);
    expect(createClient).toHaveBeenCalledWith(
      mockConfig.supabaseUrl,
      mockConfig.supabaseAnonKey,
      {
        global: {
          headers: {
            apikey: mockConfig.supabaseAnonKey,
          },
        },
      },
    );
  });

  it("should create a user client with user's auth header", () => {
    const req = new Request("http://example.com", {
      headers: { Authorization: "Bearer user_token" },
    });
    getUserClient(req);
    expect(createClient).toHaveBeenCalledWith(
      mockConfig.supabaseUrl,
      mockConfig.supabaseAnonKey,
      {
        global: {
          headers: {
            apikey: mockConfig.supabaseAnonKey,
            Authorization: "Bearer user_token",
          },
        },
      },
    );
  });

  it("should create an admin client with service role key", () => {
    getAdminClient();
    expect(createClient).toHaveBeenCalledWith(
      mockConfig.supabaseUrl,
      mockConfig.supabaseServiceRoleKey,
      {
        global: {
          headers: {
            apikey: mockConfig.supabaseServiceRoleKey,
            Authorization: `Bearer ${mockConfig.supabaseServiceRoleKey}`,
          },
        },
      },
    );
  });
});

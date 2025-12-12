// supabase/functions/tmdb-proxy/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as mod from "./index.ts";
import { __setConfigForTesting } from "../_shared/config.ts";

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("tmdb-proxy handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setConfigForTesting({
      supabaseUrl: "",
      supabaseAnonKey: "",
      supabaseServiceRoleKey: "",
      tmdbApiReadAccessToken: "test-token",
    });
  });

  it("should proxy a valid search request", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ results: [] })));

    const req = new Request("http://example.com/tmdb-proxy", {
      method: "POST",
      body: JSON.stringify({
        path: "/search/multi",
        params: { query: "test" },
      }),
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.results).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("query=test"),
      expect.any(Object),
    );
  });

  it("should reject an invalid path", async () => {
    const req = new Request("http://example.com/tmdb-proxy", {
      method: "POST",
      body: JSON.stringify({
        path: "/movie/popular",
        params: {},
      }),
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
  });
});

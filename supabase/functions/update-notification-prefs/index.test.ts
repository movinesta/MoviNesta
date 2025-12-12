// supabase/functions/update-notification-prefs/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";
import { getUserClient } from "../_shared/supabase.ts";

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("../_shared/supabase.ts", () => ({
  getUserClient: vi.fn(),
}));

describe("update-notification-prefs handler", () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-a" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { email_activity: false }, error: null }),
    };
    (getUserClient as vi.Mock).mockReturnValue(mockSupabaseClient);
  });

  it("should get default preferences for a new user", async () => {
    const req = new Request("http://example.com/update-notification-prefs");
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preferences.email_activity).toBe(true);
  });

  it("should update preferences on POST", async () => {
    const req = new Request("http://example.com/update-notification-prefs", {
      method: "POST",
      body: JSON.stringify({ emailActivity: false }),
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preferences.email_activity).toBe(false);
    expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email_activity: false }),
      expect.any(Object),
    );
  });
});

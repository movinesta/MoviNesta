import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchBlockStatus } from "./useBlockStatus";

const mockRows: Array<{ blocker_id: string; blocked_id: string }> = [];

const mockClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    or: vi.fn(async () => ({ data: [...mockRows], error: null })),
  })),
};

describe("fetchBlockStatus", () => {
  beforeEach(() => {
    mockRows.length = 0;
    vi.clearAllMocks();
  });

  it("returns false flags when no block rows exist", async () => {
    const status = await fetchBlockStatus(mockClient as any, "me", "them");

    expect(status).toEqual({ youBlocked: false, blockedYou: false });
    expect(mockClient.from).toHaveBeenCalledWith("blocked_users");
  });

  it("detects when the current user blocked the other user", async () => {
    mockRows.push({ blocker_id: "me", blocked_id: "them" });

    const status = await fetchBlockStatus(mockClient as any, "me", "them");

    expect(status).toEqual({ youBlocked: true, blockedYou: false });
  });

  it("detects when the other user blocked the current user", async () => {
    mockRows.push({ blocker_id: "them", blocked_id: "me" });

    const status = await fetchBlockStatus(mockClient as any, "me", "them");

    expect(status).toEqual({ youBlocked: false, blockedYou: true });
  });

  it("throws when the Supabase query fails", async () => {
    const failingClient = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        or: vi.fn(async () => ({ data: null, error: new Error("boom") })),
      })),
    };

    await expect(fetchBlockStatus(failingClient as any, "me", "them")).rejects.toThrow("boom");
  });
});

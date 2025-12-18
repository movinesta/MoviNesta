import { describe, expect, it } from "vitest";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { getRealtimeNewRow, getRealtimeOldRow, getStringField, hasConversationId } from "./realtimeGuards";

describe("realtimeGuards", () => {
  it("extracts new/old rows from realtime payloads", () => {
    const payload =
      ({ new: { id: "m1" }, old: { id: "m0" } } as unknown as RealtimePostgresChangesPayload<
        Record<string, unknown>
      >);
    expect(getStringField(getRealtimeNewRow(payload), "id")).toBe("m1");
    expect(getStringField(getRealtimeOldRow(payload), "id")).toBe("m0");
  });

  it("returns null for missing fields and non-object rows", () => {
    const payload =
      ({ new: null, old: "not-an-object" } as unknown as RealtimePostgresChangesPayload<
        Record<string, unknown>
      >);
    expect(getStringField(getRealtimeNewRow(payload), "id")).toBeNull();
    expect(getStringField(getRealtimeOldRow(payload), "id")).toBeNull();
  });

  it("checks conversation_id", () => {
    const payload =
      ({ new: { conversation_id: "c1" } } as unknown as RealtimePostgresChangesPayload<
        Record<string, unknown>
      >);
    expect(hasConversationId(getRealtimeNewRow(payload), "c1")).toBe(true);
    expect(hasConversationId(getRealtimeNewRow(payload), "c2")).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTimeAgo } from "./formatTimeAgo";

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-31T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when given an empty value", () => {
    expect(formatTimeAgo(null)).toBeNull();
    expect(formatTimeAgo("not-a-date")).toBeNull();
  });

  it("treats future timestamps as just now", () => {
    expect(formatTimeAgo("2024-02-01T00:00:00Z")).toBe("Just now");
  });

  it("handles seconds and minutes", () => {
    expect(formatTimeAgo("2024-01-31T11:59:40Z")).toBe("Just now");
    expect(formatTimeAgo("2024-01-31T11:55:00Z")).toBe("5 min ago");
  });

  it("handles hours and days", () => {
    expect(formatTimeAgo("2024-01-31T10:00:00Z")).toBe("2 h ago");
    expect(formatTimeAgo("2024-01-30T12:00:00Z")).toBe("Yesterday");
    expect(formatTimeAgo("2024-01-25T12:00:00Z")).toBe("6 days ago");
  });

  it("handles weeks, months, and years", () => {
    expect(formatTimeAgo("2024-01-17T12:00:00Z")).toBe("2 wks ago");
    expect(formatTimeAgo("2023-11-01T12:00:00Z")).toBe("3 mos ago");
    expect(formatTimeAgo("2022-01-31T12:00:00Z")).toBe("2 yrs ago");
  });

  it("avoids showing zero months when crossing the month boundary", () => {
    // 28 days ago should stay in weeks, not "0 mos".
    expect(formatTimeAgo("2024-01-03T12:00:00Z")).toBe("4 wks ago");

    // Once we cross 30 days we should start showing months.
    expect(formatTimeAgo("2023-12-15T12:00:00Z")).toBe("1 mo ago");
  });
});

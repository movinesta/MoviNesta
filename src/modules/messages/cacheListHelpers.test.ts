import { describe, expect, it } from "vitest";
import { removeFromList, upsertIntoList } from "./cacheListHelpers";

describe("cacheListHelpers", () => {
  it("upserts into an empty list", () => {
    const next = upsertIntoList(undefined, { id: "a", n: 1 }, { key: (x) => x.id });
    expect(next).toEqual([{ id: "a", n: 1 }]);
  });

  it("replaces an existing item with the same key", () => {
    const next = upsertIntoList(
      [{ id: "a", n: 1 }, { id: "b", n: 2 }],
      { id: "a", n: 9 },
      { key: (x) => x.id },
    );
    expect(next).toEqual([{ id: "a", n: 9 }, { id: "b", n: 2 }]);
  });

  it("inserts and sorts when a sort function is provided", () => {
    const next = upsertIntoList(
      [{ id: "b", n: 2 }],
      { id: "a", n: 1 },
      { key: (x) => x.id, sort: (a, b) => a.n - b.n },
    );
    expect(next).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ]);
  });

  it("removes by key", () => {
    const next = removeFromList(
      [{ id: "a", n: 1 }, { id: "b", n: 2 }],
      "a",
      { key: (x) => x.id },
    );
    expect(next).toEqual([{ id: "b", n: 2 }]);
  });

  it("removeFromList returns empty for empty input", () => {
    expect(removeFromList(undefined, "a", { key: (x: { id: string }) => x.id })).toEqual([]);
  });
});

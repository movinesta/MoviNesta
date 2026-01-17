import { describe, expect, it } from "vitest";
import { applyTextInferences, normalizeToolArgs } from "./assistantToolArgs.ts";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("assistantToolArgs", () => {
  it("normalizes snake_case list_add_item args", () => {
    const normalized = normalizeToolArgs("list_add_item", {
      list_id: "22222222-2222-4222-8222-222222222222",
      title_id: UUID,
      content_type: "movie",
    });

    expect(normalized.listId).toBe("22222222-2222-4222-8222-222222222222");
    expect(normalized.titleId).toBe(UUID);
    expect(normalized.contentType).toBe("movie");
  });

  it("infers list name from user text for list_add_item", () => {
    const inferred = applyTextInferences(
      "list_add_item",
      { titleId: UUID },
      'please add this to list "Weekend Picks"',
    );

    expect(inferred.listName).toBe("Weekend Picks");
    expect(inferred.titleId).toBe(UUID);
  });

  it("infers titleId and listName for list_remove_item confirm text", () => {
    const inferred = applyTextInferences(
      "list_remove_item",
      {},
      `remove titleId=${UUID} from list "Watchlist"`,
    );

    expect(inferred.titleId).toBe(UUID);
    expect(inferred.listName).toBe("Watchlist");
  });

  it("infers list name for list_set_visibility", () => {
    const inferred = applyTextInferences(
      "list_set_visibility",
      { isPublic: true },
      "make list \"Favorites\" public",
    );

    expect(inferred.listName).toBe("Favorites");
    expect(inferred.isPublic).toBe(true);
  });

  it("normalizes list_add_items with a single titleId fallback", () => {
    const normalized = normalizeToolArgs("list_add_items", {
      title_id: UUID,
      list_name: "Top Picks",
    });

    expect(normalized.titleIds).toEqual([UUID]);
    expect(normalized.listName).toBe("Top Picks");
  });

  it("accepts diary_set_status without contentType", () => {
    const normalized = normalizeToolArgs("diary_set_status", {
      title_id: UUID,
      status: "watched",
    });

    expect(normalized.titleId).toBe(UUID);
    expect(normalized.contentType).toBeUndefined();
  });
});

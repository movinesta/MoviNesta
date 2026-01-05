import { describe, expect, it } from "vitest";
import { resolveVirtualTitleId } from "./virtualTitleId";

describe("resolveVirtualTitleId", () => {
  it("resolves tmdb virtual ids to canonical uuids", async () => {
    const uuid = "3f4b3c6e-7c5d-4f1f-9c7a-0d5a6b7c8d9e";
    const resolver = async () => ({
      ok: true as const,
      media_item_id: uuid,
      kind: "movie" as const,
      tmdb_id: 123,
      omdb_imdb_id: null,
    });

    await expect(resolveVirtualTitleId("tmdb-123", resolver)).resolves.toBe(uuid);
  });
});

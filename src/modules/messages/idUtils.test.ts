import { describe, expect, it } from "vitest";
import {
  TEMP_ID_PREFIX,
  createRandomTempId,
  createTimestampTempId,
  ensureTempId,
  isTempId,
  normalizeIdList,
} from "./idUtils";

describe("idUtils", () => {
  it("detects temp ids", () => {
    expect(isTempId("temp-123")).toBe(true);
    expect(isTempId("abc")).toBe(false);
  });

  it("ensures temp prefix", () => {
    expect(ensureTempId("temp-123")).toBe("temp-123");
    expect(ensureTempId("123")).toBe("temp-123");
  });

  it("creates timestamp temp ids", () => {
    expect(createTimestampTempId(123)).toBe(`${TEMP_ID_PREFIX}123`);
  });

  it("creates random temp ids", () => {
    const id = createRandomTempId(123);
    expect(id.startsWith(`${TEMP_ID_PREFIX}123-`)).toBe(true);
  });

  it("normalizes id lists", () => {
    expect(
      normalizeIdList([" a ", "", "b", "a", null, undefined, "temp-1"], {
        excludeTemp: true,
        sort: true,
      }),
    ).toEqual(["a", "b"]);
  });
});

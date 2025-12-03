import { describe, expect, it } from "vitest";
import { getMessageMeta, getMessagePreview, parseMessageText } from "../modules/messages/messageText";

describe("parseMessageText", () => {
  it("handles plain strings and null bodies", () => {
    expect(parseMessageText("hello world")).toBe("hello world");
    expect(parseMessageText(null)).toBe("");
  });

  it("parses JSON payloads with text and blocks", () => {
    expect(parseMessageText(JSON.stringify({ text: "hi there" }))).toBe("hi there");

    const blockPayload = {
      blocks: [
        { text: " first line " },
        { text: "" },
        { text: "second line" },
      ],
    };
    expect(parseMessageText(JSON.stringify(blockPayload))).toBe("first line\nsecond line");
  });

  it("returns friendly placeholders for image messages", () => {
    expect(parseMessageText(JSON.stringify({ type: "image" }))).toBe("Photo");
    expect(parseMessageText(JSON.stringify({ type: "image", caption: "sunset" }))).toBe("sunset");
  });

  it("falls back to generic message field or raw body", () => {
    expect(parseMessageText(JSON.stringify({ message: "hello" }))).toBe("hello");
    expect(parseMessageText("{not-json")).toBe("{not-json");
  });
});

describe("getMessagePreview", () => {
  it("normalizes whitespace and clamps the length", () => {
    const body = JSON.stringify({ text: "A long message that should be truncated once it exceeds the preview budget" });
    const preview = getMessagePreview(body, 40);
    expect(preview).toBe("A long message that should be truncated…");
  });

  it("returns a friendlier label for photo placeholders", () => {
    const body = JSON.stringify({ type: "image" });
    expect(getMessagePreview(body)).toBe("📷 Photo");
  });

  it("returns null when the parsed body is empty", () => {
    expect(getMessagePreview(null)).toBeNull();
    expect(getMessagePreview(JSON.stringify({ text: "   " }))).toBeNull();
  });
});

describe("getMessageMeta", () => {
  it("extracts edited and deleted metadata when present", () => {
    const payload = {
      text: "hello",
      editedAt: "2025-12-03T20:00:00Z",
      deletedAt: "2025-12-03T20:01:00Z",
      deleted: true,
    };

    expect(getMessageMeta(JSON.stringify(payload))).toEqual({
      editedAt: payload.editedAt,
      deletedAt: payload.deletedAt,
      deleted: true,
    });
  });

  it("returns an empty object for plain text or malformed JSON", () => {
    expect(getMessageMeta("plain text")).toEqual({});
    expect(getMessageMeta("{bad-json")).toEqual({});
    expect(getMessageMeta(null)).toEqual({});
  });
});

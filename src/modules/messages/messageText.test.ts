import { describe, expect, it } from "vitest";

import { getMessagePreview, parseMessageText } from "./messageText";

describe("messageText", () => {
  it("returns Photo for image-only messages even when text is empty", () => {
    const body = JSON.stringify({ type: "image", text: "", clientId: "c1" });
    expect(parseMessageText(body)).toBe("Photo");
    expect(getMessagePreview(body)).toBe("📷 Photo");
  });

  it("returns caption for image messages with caption", () => {
    const body = JSON.stringify({ type: "image", text: "", caption: "hello", clientId: "c1" });
    expect(parseMessageText(body)).toBe("hello");
    expect(getMessagePreview(body)).toBe("hello");
  });

  it("returns deleted placeholder and stable preview for deleted messages", () => {
    const body = JSON.stringify({
      type: "system",
      deleted: true,
      deletedAt: "2024-01-01T00:00:00Z",
    });
    expect(parseMessageText(body)).toBe("Message deleted");
    expect(getMessagePreview(body)).toBe("🗑️ Message deleted");
  });
});

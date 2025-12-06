import React from "react";
import { describe, it, beforeEach, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { ChatImage } from "./ConversationPage";


const createSignedUrl = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl,
      }),
    },
  },
}));

beforeEach(() => {
  vi.useRealTimers();
  createSignedUrl.mockReset();
});

describe("ChatImage", () => {
  it("shows loading skeleton while signing URL", () => {
    createSignedUrl.mockResolvedValue({ data: null, error: null });

    const { container } = render(<ChatImage path="conversation/123/file.png" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders signed image with lazy loading", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://cdn.example.com/file.png" },
      error: null,
    });

    render(<ChatImage path="conversation/123/file.png" />);

    await waitFor(() => {
      const image = screen.getByAltText("Attachment") as HTMLImageElement;
      expect(image).toBeInTheDocument();
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.src).toContain("cdn.example.com/file.png");
    });
  });

  it("shows fallback text on signing error", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: new Error("boom") });

    render(<ChatImage path="conversation/123/file.png" />);

    await waitFor(() => {
      expect(screen.getByText(/Image unavailable/i)).toBeInTheDocument();
    });
  });
});

import React from "react";
import { describe, it, beforeEach, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ChatImage } from "./components/ChatImage";

const createSignedUrl = vi.fn();
const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "" } }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl,
        getPublicUrl,
      }),
    },
  },
}));

beforeEach(() => {
  vi.useRealTimers();
  createSignedUrl.mockReset();
  getPublicUrl.mockReset();
});

afterEach(() => {
  cleanup();
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

  it("recovers when the path changes after an error", async () => {
    createSignedUrl
      .mockResolvedValueOnce({ data: null, error: new Error("boom") })
      .mockResolvedValueOnce({ data: { signedUrl: "https://cdn.example.com/new.png" }, error: null });

    const { rerender } = render(<ChatImage path="conversation/123/file.png" />);

    await waitFor(() => {
      expect(screen.getByText(/Image unavailable/i)).toBeInTheDocument();
    });

    rerender(<ChatImage path="conversation/456/other.png" />);

    await waitFor(() => {
      const image = screen.getByAltText("Attachment") as HTMLImageElement;
      expect(image.src).toContain("cdn.example.com/new.png");
    });
  });
});

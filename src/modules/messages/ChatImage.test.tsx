import React from "react";
import { describe, it, beforeEach, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatImage } from "./components/ChatImage";

const resolveStorageUrl = vi.fn<(...args: unknown[]) => Promise<string | null>>();
const getPublicStorageUrl = vi.fn<(...args: unknown[]) => string | null>();

vi.mock("./storageUrls", () => ({
  resolveStorageUrl: (...args: unknown[]) => resolveStorageUrl(...args),
  getPublicStorageUrl: (...args: unknown[]) => getPublicStorageUrl(...args),
  isHttpUrl: (value: string) => /^https?:\/\//i.test(value),
}));

beforeEach(() => {
  vi.useRealTimers();
  resolveStorageUrl.mockReset();
  getPublicStorageUrl.mockReset();
  resolveStorageUrl.mockResolvedValue("https://cdn.example.com/file.png");
});

afterEach(() => {
  cleanup();
});

describe("ChatImage", () => {
  it("shows loading skeleton while signing URL", () => {
    const { container } = render(<ChatImage path="conversation/123/file.png" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders signed image with lazy loading", async () => {
    render(<ChatImage path="conversation/123/file.png" />);

    await waitFor(() => {
      const image = screen.getByAltText("Attachment") as HTMLImageElement;
      expect(image).toBeInTheDocument();
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.src).toContain("cdn.example.com/file.png");
    });
  });

  it("uses external URLs directly without signing", async () => {
    const external = "https://example.com/path/to/image.png";

    render(<ChatImage path={external} />);

    const image = await screen.findByAltText("Attachment");
    expect(image).toBeInTheDocument();
    expect(image.getAttribute("src")).toBe(external);
    expect(resolveStorageUrl).not.toHaveBeenCalled();
  });

  it("shows fallback text on signing error", async () => {
    resolveStorageUrl.mockRejectedValue(new Error("boom"));

    render(<ChatImage path="conversation/123/file.png" />);

    await waitFor(() => {
      expect(screen.getByText(/Image unavailable/i)).toBeInTheDocument();
    });
  });

  it("recovers when the path changes after an error", async () => {
    resolveStorageUrl
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("https://cdn.example.com/new.png");

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

  it("retries once before falling back when refreshed URL stays the same", async () => {
    resolveStorageUrl
      .mockResolvedValueOnce("https://cdn.example.com/signed.png")
      .mockResolvedValueOnce("https://cdn.example.com/signed.png");
    getPublicStorageUrl.mockReturnValue(null);

    render(<ChatImage path="conversation/123/file.png" />);

    const image = await screen.findByAltText("Attachment");
    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.getByText(/Image unavailable/i)).toBeInTheDocument();
    });
  });

  it("surfaces external URL errors without retrying", async () => {
    render(<ChatImage path="https://example.com/path/to/image.png" />);

    const image = await screen.findByAltText("Attachment");
    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.getByText(/Image unavailable/i)).toBeInTheDocument();
    });

    expect(resolveStorageUrl).not.toHaveBeenCalled();
  });
});

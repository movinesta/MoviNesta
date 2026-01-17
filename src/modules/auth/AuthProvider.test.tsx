import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";

type AuthStateCallback = (event: string, session: { user: User } | null) => void;

const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockSubscription = { unsubscribe: vi.fn() };

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      onAuthStateChange: (callback: AuthStateCallback) => {
        callback("INITIAL_SESSION", null);
        return { data: { subscription: mockSubscription } };
      },
    },
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const mockUser = { id: "user-123" } as User;

describe("AuthProvider", () => {
  beforeEach(() => {
    mockSubscription.unsubscribe = vi.fn();
    mockGetUser.mockReset();
    mockSignOut.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts loading and resolves to no session when getUser returns null", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it("restores an existing Supabase session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(mockUser);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it("clears user state when signOut succeeds", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.user).toEqual(mockUser);

    await act(async () => {
      await result.current.signOut();
    });

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

import { QueryClient } from "@tanstack/react-query";
import { toast } from "../components/toasts";

const getErrorMessage = (error: unknown) => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return "Something went wrong. Please try again.";
};

const dynamicDataStaleTimeMs = 1000 * 15;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: dynamicDataStaleTimeMs,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      onError: (error: Error) => {
        toast.error(getErrorMessage(error));
      },
    },
    mutations: {
      onError: (error: Error) => {
        toast.error(getErrorMessage(error));
      },
    },
  },
});

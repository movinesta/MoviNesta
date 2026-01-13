import { QueryClient } from "@tanstack/react-query";

const dynamicDataStaleTimeMs = 1000 * 15;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: dynamicDataStaleTimeMs,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});

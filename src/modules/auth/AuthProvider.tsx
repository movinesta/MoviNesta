import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { queryClient } from "../../lib/react-query";
import { qk } from "../../lib/queryKeys";
import { fetchHomeFeedPage } from "../home/useHomeFeed";
import { fetchDiaryStats } from "../diary/useDiaryStats";
import { fetchConversationSummaries } from "../messages/useConversations";
import { prefillSwipeDeckCache } from "../swipe/useSwipeDeck";
import type { SwipeDeckKindOrCombined } from "../swipe/useSwipeDeck";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const prefetchedForUserRef = useRef<string | null>(null);

  const loadUser = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Error loading auth user:", error.message);
    }

    setUser(data?.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial user load
    void loadUser();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUser]);

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;

    const userId = user?.id;
    if (!userId) {
      prefetchedForUserRef.current = null;
      return;
    }

    if (prefetchedForUserRef.current === userId) return;
    prefetchedForUserRef.current = userId;

    const swipeVariants: SwipeDeckKindOrCombined[] = [
      "combined",
      "for-you",
      "from-friends",
      "trending",
    ];

    const prefetchAfterSignIn = async () => {
      await Promise.allSettled([
        queryClient.prefetchInfiniteQuery({
          queryKey: qk.homeFeed(userId),
          initialPageParam: null as string | null,
          queryFn: ({ pageParam }) => fetchHomeFeedPage(userId, pageParam ?? null),
        }),
        queryClient.prefetchQuery({
          queryKey: ["conversations", userId],
          queryFn: () => fetchConversationSummaries(userId),
        }),
        queryClient.prefetchQuery({
          queryKey: qk.diaryStats(userId),
          queryFn: () => fetchDiaryStats(userId),
        }),
        ...swipeVariants.map((variant) =>
          prefillSwipeDeckCache(queryClient, variant, {
            limit: variant === "combined" ? 36 : 18,
            skipRerank: true,
          }),
        ),
      ]);
    };

    void prefetchAfterSignIn();
  }, [user?.id]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error.message);
    }
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

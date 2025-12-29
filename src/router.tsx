import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./layouts/AppShell";
import { LoadingScreen } from "@/components/ui/loading-screen";
import RequireAuth from "./modules/auth/RequireAuth";
import { lazyWithRetry } from "./lib/lazyWithRetry";

// Auth
const SignInPage = lazyWithRetry(() => import("./modules/auth/SignInPage"));
const SignUpPage = lazyWithRetry(() => import("./modules/auth/SignUpPage"));
const ForgotPasswordPage = lazyWithRetry(() => import("./modules/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazyWithRetry(() => import("./modules/auth/ResetPasswordPage"));

// Shell routes (inside AppShell)
const HomePage = lazyWithRetry(() => import("./modules/home/HomePage"));
const SwipePage = lazyWithRetry(() => import("./modules/swipe/SwipePage"));
const SwipePageClassic = lazyWithRetry(() => import("./modules/swipe/SwipePageClassic"));
const SearchPage = lazyWithRetry(() => import("./modules/search/SearchPage"));
const DiaryPage = lazyWithRetry(() => import("./modules/diary/DiaryPage"));
const ProfilePage = lazyWithRetry(() => import("./modules/profile/ProfilePage"));
const MePage = lazyWithRetry(() => import("./modules/profile/MePage"));
const SuggestedPeoplePage = lazyWithRetry(() => import("./modules/profile/SuggestedPeoplePage"));
const ListDetailPage = lazyWithRetry(() => import("./modules/profile/ListDetailPage"));
const FollowersPage = lazyWithRetry(() => import("./modules/profile/FollowersPage"));
const FollowingPage = lazyWithRetry(() => import("./modules/profile/FollowingPage"));
const SettingsOverviewPage = lazyWithRetry(() => import("./modules/settings/SettingsOverviewPage"));
const SettingsProfilePage = lazyWithRetry(() => import("./modules/settings/SettingsProfilePage"));
const SettingsAccountPage = lazyWithRetry(() => import("./modules/settings/SettingsAccountPage"));
const SettingsNotificationsPage = lazyWithRetry(
  () => import("./modules/settings/SettingsNotificationsPage"),
);
const SettingsAppPage = lazyWithRetry(() => import("./modules/settings/SettingsAppPage"));
const NotFoundPage = lazyWithRetry(() => import("./modules/misc/NotFoundPage"));
const OnboardingPage = lazyWithRetry(() => import("./modules/misc/OnboardingPage"));
const TasteOnboardingPage = lazyWithRetry(() => import("./modules/misc/TasteOnboardingPage"));

const MessagesPage = lazyWithRetry(() => import("./modules/messages/MessagesPage"));
const NewMessagePage = lazyWithRetry(() => import("./modules/messages/NewMessagePage"));
const ConversationPage = lazyWithRetry(() => import("./modules/messages/ConversationPage"));
const TitleDetailPage = lazyWithRetry(() => import("./modules/title/TitleDetailPageV2"));
const TitleReviewsPage = lazyWithRetry(() => import("./modules/title/TitleReviewsPageV2"));
const ActivityPage = lazyWithRetry(() => import("./modules/activity/ActivityPage"));
const FollowRequestsPage = lazyWithRetry(() => import("./modules/activity/FollowRequestsPage"));

const AppRoutes: React.FC = () => {
  return (
    <React.Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public auth routes */}
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/signup" element={<SignUpPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/welcome" element={<OnboardingPage />} />

        {/* Authenticated application shell */}
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<TasteOnboardingPage />} />
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/search" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/swipe" element={<SwipePage />} />
            <Route path="/swipe/classic" element={<SwipePageClassic />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/new" element={<NewMessagePage />} />
            <Route path="/messages/:conversationId" element={<ConversationPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/title/:titleId" element={<TitleDetailPage />} />
            <Route path="/title/:titleId/reviews" element={<TitleReviewsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/activity/requests" element={<FollowRequestsPage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="/u/:username" element={<ProfilePage />} />
            <Route path="/u/:username/followers" element={<FollowersPage />} />
            <Route path="/u/:username/following" element={<FollowingPage />} />
            <Route path="/suggested-people" element={<SuggestedPeoplePage />} />
            <Route path="/lists/:listId" element={<ListDetailPage />} />
            <Route path="/settings" element={<SettingsOverviewPage />} />
            <Route path="/settings/profile" element={<SettingsProfilePage />} />
            <Route path="/settings/account" element={<SettingsAccountPage />} />
            <Route path="/settings/notifications" element={<SettingsNotificationsPage />} />
            <Route path="/settings/app" element={<SettingsAppPage />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </React.Suspense>
  );
};

export default AppRoutes;

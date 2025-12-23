import React from "react";
import { Routes, Route } from "react-router-dom";
import AppShell from "./layouts/AppShell";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
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
const SearchPage = lazyWithRetry(() => import("./modules/search/SearchPage"));
const DiaryPage = lazyWithRetry(() => import("./modules/diary/DiaryPage"));
const ProfilePage = lazyWithRetry(() => import("./modules/profile/ProfilePage_Improved"));
const SettingsOverviewPage = lazyWithRetry(() => import("./modules/settings/SettingsOverviewPage"));
const SettingsProfilePage = lazyWithRetry(
  () => import("./modules/settings/SettingsProfilePage_Improved"),
);
const SettingsAccountPage = lazyWithRetry(() => import("./modules/settings/SettingsAccountPage"));
const SettingsNotificationsPage = lazyWithRetry(
  () => import("./modules/settings/SettingsNotificationsPage"),
);
const SettingsAppPage = lazyWithRetry(() => import("./modules/settings/SettingsAppPage"));
const NotFoundPage = lazyWithRetry(() => import("./modules/misc/NotFoundPage"));
const OnboardingPage = lazyWithRetry(() => import("./modules/misc/OnboardingPage"));
const TasteOnboardingPage = lazyWithRetry(() => import("./modules/misc/TasteOnboardingPage"));

const MessagesPage = lazyWithRetry(() => import("./modules/messages/MessagesPage_Improved"));
const ConversationPage = lazyWithRetry(() => import("./modules/messages/ConversationPage"));
const TitleDetailPage = lazyWithRetry(() => import("./modules/title/TitleDetailPage"));

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
            <Route index element={<HomePage />} />
            <Route path="/swipe" element={<SwipePage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<ConversationPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/title/:titleId" element={<TitleDetailPage />} />
            <Route path="/u/:username" element={<ProfilePage />} />
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

import React from "react";
import { Routes, Route } from "react-router-dom";
import AppShell from "./layouts/AppShell";
import RequireAuth from "./modules/auth/RequireAuth";

// Auth
import SignInPage from "./modules/auth/SignInPage";
import SignUpPage from "./modules/auth/SignUpPage";
import ForgotPasswordPage from "./modules/auth/ForgotPasswordPage";
import ResetPasswordPage from "./modules/auth/ResetPasswordPage";

// Shell routes (inside AppShell)
import HomePage from "./modules/home/HomePage";
import SwipePage from "./modules/swipe/SwipePage";
import SearchPage from "./modules/search/SearchPage";
import DiaryPage from "./modules/diary/DiaryPage";
import ProfilePage from "./modules/profile/ProfilePage";
import SettingsProfilePage from "./modules/settings/SettingsProfilePage";
import SettingsAccountPage from "./modules/settings/SettingsAccountPage";
import SettingsNotificationsPage from "./modules/settings/SettingsNotificationsPage";
import SettingsAppPage from "./modules/settings/SettingsAppPage";
import NotFoundPage from "./modules/misc/NotFoundPage";
import OnboardingPage from "./modules/misc/OnboardingPage";

const MessagesPage = React.lazy(() => import("./modules/messages/MessagesPage"));
const ConversationPage = React.lazy(() => import("./modules/messages/ConversationPage"));
const RealtimeChatPage = React.lazy(() => import("./modules/messages/RealtimeChatPage"));
const TitleDetailPage = React.lazy(() => import("./modules/title/TitleDetailPage"));

const SuspenseFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-mn-bg text-mn-text-secondary">
    <div className="flex items-center gap-2 rounded-full border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-3 py-2 text-xs shadow-mn-card">
      <span className="h-2 w-2 animate-pulse rounded-full bg-mn-primary" aria-hidden="true" />
      <span className="font-medium text-mn-text-primary">Loading…</span>
    </div>
  </div>
);

const AppRoutes: React.FC = () => {
  return (
    <React.Suspense fallback={<SuspenseFallback />}>
      <Routes>
        {/* Public auth routes */}
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/signup" element={<SignUpPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/welcome" element={<OnboardingPage />} />

        {/* Authenticated application shell */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="/swipe" element={<SwipePage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/realtime" element={<RealtimeChatPage />} />
            <Route path="/messages/:conversationId" element={<ConversationPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/title/:titleId" element={<TitleDetailPage />} />
            <Route path="/u/:username" element={<ProfilePage />} />
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

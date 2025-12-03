import React from "react";
import { Routes, Route } from "react-router-dom";
import AppShell from "./layouts/AppShell";
import RequireAuth from "./modules/auth/RequireAuth";

// Auth
const SignInPage = React.lazy(() => import("./modules/auth/SignInPage"));
const SignUpPage = React.lazy(() => import("./modules/auth/SignUpPage"));
const ForgotPasswordPage = React.lazy(() => import("./modules/auth/ForgotPasswordPage"));
const ResetPasswordPage = React.lazy(() => import("./modules/auth/ResetPasswordPage"));

// Shell routes (inside AppShell)
const HomePage = React.lazy(() => import("./modules/home/HomePage"));
const SwipePage = React.lazy(() => import("./modules/swipe/SwipePage"));
const SearchPage = React.lazy(() => import("./modules/search/SearchPage"));
const DiaryPage = React.lazy(() => import("./modules/diary/DiaryPage"));
const ProfilePage = React.lazy(() => import("./modules/profile/ProfilePage"));
const SettingsProfilePage = React.lazy(() => import("./modules/settings/SettingsProfilePage"));
const SettingsAccountPage = React.lazy(() => import("./modules/settings/SettingsAccountPage"));
const SettingsNotificationsPage = React.lazy(() => import("./modules/settings/SettingsNotificationsPage"));
const SettingsAppPage = React.lazy(() => import("./modules/settings/SettingsAppPage"));
const NotFoundPage = React.lazy(() => import("./modules/misc/NotFoundPage"));
const OnboardingPage = React.lazy(() => import("./modules/misc/OnboardingPage"));

const MessagesPage = React.lazy(() => import("./modules/messages/MessagesPage"));
const ConversationPage = React.lazy(() => import("./modules/messages/ConversationPage"));
const RealtimeChatPage = React.lazy(() => import("./modules/messages/RealtimeChatPage"));
const TitleDetailPage = React.lazy(() => import("./modules/title/TitleDetailPage"));

const SuspenseFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-mn-bg">
    <div className="flex items-end gap-1.5 rounded-2xl border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-3 py-2 shadow-mn-card">
      <span
        className="h-3 w-1.5 animate-bounce rounded-full bg-mn-primary"
        style={{ animationDelay: "0ms" }}
        aria-hidden="true"
      />
      <span
        className="h-4 w-1.5 animate-bounce rounded-full bg-mn-primary/80"
        style={{ animationDelay: "140ms" }}
        aria-hidden="true"
      />
      <span
        className="h-5 w-1.5 animate-bounce rounded-full bg-mn-primary/60"
        style={{ animationDelay: "280ms" }}
        aria-hidden="true"
      />
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

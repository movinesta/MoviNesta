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
import MessagesPage from "./modules/messages/MessagesPage";
import ConversationPage from "./modules/messages/ConversationPage";
import SearchPage from "./modules/search/SearchPage";
import DiaryPage from "./modules/diary/DiaryPage";
import TitleDetailPage from "./modules/title/TitleDetailPage";
import ProfilePage from "./modules/profile/ProfilePage";
import SettingsProfilePage from "./modules/settings/SettingsProfilePage";
import SettingsAccountPage from "./modules/settings/SettingsAccountPage";
import SettingsNotificationsPage from "./modules/settings/SettingsNotificationsPage";
import SettingsAppPage from "./modules/settings/SettingsAppPage";
import NotFoundPage from "./modules/misc/NotFoundPage";
import OnboardingPage from "./modules/misc/OnboardingPage";

const AppRoutes: React.FC = () => {
  return (
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
  );
};

export default AppRoutes;

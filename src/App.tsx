/**
 * Root Application Component with HashRouter, Theme Initialization, and Navigation Dock.
 */

import React, { useEffect } from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { MobileNav } from "./components/MobileNav";
import { HomeView } from "./views/HomeView";
import { LibraryView } from "./views/LibraryView";
import { TestDetailsView } from "./views/TestDetailsView";
import { SettingsView } from "./views/SettingsView";
import { AboutView } from "./views/AboutView";
import { ExamView } from "./views/ExamView";
import { PracticeView } from "./views/PracticeView";
import { TrainView } from "./views/TrainView";
import { TopicDetailView } from "./views/TopicDetailView";
import { ResultView } from "./views/ResultView";
import { AnalyticsView } from "./views/AnalyticsView";
import { MistakeNotebookView } from "./views/MistakeNotebookView";
import { LeaderboardView } from "./views/LeaderboardView";
import { ReviewView } from "./views/ReviewView";
import { useAppStore } from "./store/useAppStore";
import { backfillQuestionStatsFromAttempts } from "./db";

function AppContent() {
  const location = useLocation();
  const isImmersive =
    location.pathname.startsWith("/exam") ||
    location.pathname.startsWith("/practice") ||
    location.pathname.endsWith("/learn");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors flex flex-col">
      {!isImmersive && <Navbar />}

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/train" element={<TrainView />} />
          <Route path="/train/:topicId" element={<TopicDetailView />} />
          <Route path="/train/:topicId/learn" element={<PracticeView isTopicLearnMode={true} />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/leaderboard" element={<LeaderboardView />} />
          <Route path="/test/:testId" element={<TestDetailsView />} />
          <Route path="/exam/:testId" element={<ExamView />} />
          <Route path="/practice/:testId" element={<PracticeView />} />
          <Route path="/result/:attemptId" element={<ResultView />} />
          <Route path="/analytics" element={<AnalyticsView />} />
          <Route path="/mistakes" element={<MistakeNotebookView />} />
          <Route path="/notebook" element={<MistakeNotebookView />} />
          <Route path="/bookmarks" element={<MistakeNotebookView initialTab="bookmarks" />} />
          <Route path="/review" element={<ReviewView />} />
          <Route path="/review/:testId" element={<ReviewView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/about" element={<AboutView />} />
          {/* Fallback routes */}
          <Route path="*" element={<HomeView />} />
        </Routes>
      </main>

      {!isImmersive && <MobileNav />}
    </div>
  );
}

export default function App() {
  const { settings, refreshStats, refreshInProgress, fetchManifest } = useAppStore();

  useEffect(() => {
    // Initialize theme
    if (
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Refresh core app data
    refreshStats();
    refreshInProgress();
    fetchManifest();
    backfillQuestionStatsFromAttempts().catch(console.error);
  }, [settings.theme, refreshStats, refreshInProgress, fetchManifest]);

  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}


/**
 * Home View: Dashboard featuring Quizzy Mascot, streak tracking, resume banner,
 * recommended mock tests, and quick practice modes.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Flame,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  ArrowRight,
  BookOpen,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import { Mascot } from "../components/Mascot";
import { Leaderboard } from "../components/Leaderboard";
import { useAppStore } from "../store/useAppStore";
import messages from "../content/messages.json";
import { getAllAttempts } from "../db";
import type { TestAttemptSummary } from "../types";

export const HomeView: React.FC = () => {
  const { manifest, fetchManifest, userStats, inProgressAttempts, refreshInProgress } =
    useAppStore();
  const [recentAttempts, setRecentAttempts] = useState<TestAttemptSummary[]>([]);
  const [greeting, setGreeting] = useState("Welcome to ExamQuest!");

  useEffect(() => {
    fetchManifest();
    refreshInProgress();
    getAllAttempts().then((attempts) => setRecentAttempts(attempts.slice(0, 3)));

    const welcomeLines = messages.welcome_back;
    const randomLine = welcomeLines[Math.floor(Math.random() * welcomeLines.length)];
    setGreeting(randomLine);
  }, [fetchManifest, refreshInProgress]);

  const activeAttempt = inProgressAttempts[0];
  const recommendedTest = manifest?.tests?.[0];

  const daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];
  const currentDayIndex = (new Date().getDay() + 6) % 7; // Monday = 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-8">
      {/* Top Welcome Mascot Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Decorative backdrop shapes */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-32 -top-10 w-48 h-48 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-amber-300 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              SSC CGL Prep Companion
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Ready to conquer your next mock?
            </h1>
            <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
              Practice genuine previous-year & memory-based exam papers with realistic section
              timers, instant learning feedback, and zero guesswork.
            </p>
            <div className="pt-2 flex flex-wrap gap-3 justify-center md:justify-start">
              {recommendedTest && (
                <Link
                  to={`/test/${recommendedTest.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-2xl shadow-lg transition-transform hover:scale-105"
                >
                  <Play className="w-4 h-4 fill-slate-900" />
                  Start Recommended Paper
                </Link>
              )}
              <Link
                to="/library"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold rounded-2xl backdrop-blur-sm transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Browse All Papers
              </Link>
            </div>
          </div>

          <div className="flex-shrink-0">
            <Mascot state="happy" size="lg" message={greeting} />
          </div>
        </div>
      </div>

      {/* Resume In-Progress Attempt Card (if any active test in IndexedDB) */}
      {activeAttempt && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
              <RotateCcw className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                In-Progress Test Found
              </span>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                {activeAttempt.testId}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Mode: {activeAttempt.mode.toUpperCase()} • Q{activeAttempt.currentQuestionIndex + 1} •{" "}
                {Math.ceil(activeAttempt.remainingSeconds / 60)} mins remaining
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              to={`/exam/${activeAttempt.testId}?resume=1`}
              className="flex-1 sm:flex-none text-center px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow transition-colors"
            >
              Resume Test
            </Link>
            <button
              onClick={() => useAppStore.getState().removeInProgress(activeAttempt.testId)}
              className="px-3 py-2.5 text-xs text-slate-500 hover:text-red-500 dark:hover:text-red-400 font-medium"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Stats, Streak & Daily Goal Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Streak Tracker Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
                <Flame className="w-5 h-5 fill-amber-500 text-amber-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  Daily Streak
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Practice every day</p>
              </div>
            </div>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {userStats.streak} Days
            </span>
          </div>

          {/* Mini week calendar tracker */}
          <div className="flex justify-between items-center pt-2">
            {daysOfWeek.map((day, idx) => {
              const isActive =
                userStats.streak > 0 &&
                idx <= currentDayIndex &&
                currentDayIndex - idx < userStats.streak;
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                    {day}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                      isActive
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {isActive ? <CheckCircle2 className="w-4 h-4" /> : "•"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total Questions Solved */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Questions Solved
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {userStats.totalAnswered}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Accuracy:{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {userStats.totalAnswered > 0
                  ? `${Math.round((userStats.totalCorrect / userStats.totalAnswered) * 100)}%`
                  : "0%"}
              </span>
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>
        </div>

        {/* Total Mocks Completed */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Mocks Completed
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {userStats.completedTestsCount}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              XP Earned: <span className="font-bold text-blue-600">{userStats.xp} XP</span>
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <Trophy className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600 dark:text-sky-400" />
          Quick Practice Modes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to={recommendedTest ? `/exam/${recommendedTest.id}?mode=full` : "/library"}
            className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Full Mock Exam
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              60 min timed test • Strict 15 min sections • Real SSC marking (+2 / -0.5)
            </p>
          </Link>

          <Link
            to={recommendedTest ? `/practice/${recommendedTest.id}` : "/library"}
            className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Learn & Practice
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Untimed mode with Quizzy reactions, XP rewards, and instant feedback.
            </p>
          </Link>

          <Link
            to="/mistakes"
            className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Mistake Notebook
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Re-attempt questions you previously answered wrong or bookmarked.
            </p>
          </Link>
        </div>
      </div>

      {/* Solo Tier & Progress Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
              Practice Tier & Progress
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track your personal preparation milestones and local XP level.
            </p>
          </div>
          <Link
            to="/leaderboard"
            className="text-xs sm:text-sm font-bold text-blue-600 dark:text-sky-400 hover:underline flex items-center gap-1"
          >
            Tier Details <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <Leaderboard compact={true} />
      </div>

      {/* Available Papers Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-sky-400" />
            Featured Examination Papers
          </h2>
          <Link
            to="/library"
            className="text-xs sm:text-sm font-bold text-blue-600 dark:text-sky-400 hover:underline flex items-center gap-1"
          >
            View all ({manifest?.tests?.length || 0}) <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {manifest?.tests?.slice(0, 6).map((test) => (
            <div
              key={test.id}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-sky-400">
                    {test.date}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {test.total_questions} Questions
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base line-clamp-2">
                  {test.title}
                </h3>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {test.sections.map((s) => (
                    <span
                      key={s.id}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    >
                      {s.name.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <Link
                  to={`/test/${test.id}`}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  View Details
                </Link>
                <Link
                  to={`/test/${test.id}`}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-transform active:scale-95"
                >
                  Take Test
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

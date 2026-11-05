/**
 * Leaderboard Component: Honest placeholder displaying the student's personal
 * league tier and progress, clearly stating that multi-user leaderboards are coming soon.
 * Zero fictional competitors or fake ranks.
 */

import React from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Zap,
  Sparkles,
  Shield,
  Play,
  Clock,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { Mascot } from "./Mascot";
import { getLeagueTier, getTierColor, calculateLevel } from "../utils/gamification";

interface LeaderboardProps {
  compact?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ compact = false }) => {
  const { userStats } = useAppStore();
  const tier = getLeagueTier(userStats.xp);
  const tierColor = getTierColor(tier);
  const levelInfo = calculateLevel(userStats.xp);

  if (compact) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                Your Practice Tier
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personal progress milestone
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${tierColor.bg} ${tierColor.text} ${tierColor.border}`}
          >
            {tier} League
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Level {levelInfo.level}: {levelInfo.title}
            </span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {userStats.xp} XP
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Multi-user peer rankings are in development. All XP shown is computed strictly from your genuine mock attempts and practice sessions.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Link
            to="/leaderboard"
            className="text-xs font-bold text-blue-600 dark:text-sky-400 hover:underline"
          >
            View League Rules
          </Link>
          <Link
            to="/library"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Earn More XP
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Announcement Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 font-bold text-xs uppercase tracking-wider backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Feature In Development
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Leaderboards & Peer Rankings: Coming Soon
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              We do not display simulated competitor ranks. Real-time multi-user leaderboards will launch once verified peer synchronization is enabled.
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              In the meantime, your personal XP, daily streak, and tier achievements are recorded locally from every test you complete.
            </p>
          </div>

          <div className="shrink-0">
            <Mascot state="happy" size="lg" message="Build your real skills today! Authentic peer rankings will arrive soon!" />
          </div>
        </div>
      </div>

      {/* User's Verified Solo Progress Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Your Solo Progress Card
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data generated 100% from your activity on this device
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${tierColor.bg} ${tierColor.text} ${tierColor.border}`}
            >
              {tier} League
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Experience Points
            </span>
            <div className="text-2xl font-black text-amber-500 flex items-center gap-1.5">
              <Zap className="w-5 h-5 fill-amber-500" />
              {userStats.xp} XP
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Daily Streak
            </span>
            <div className="text-2xl font-black text-rose-500 flex items-center gap-1.5">
              <Flame className="w-5 h-5 fill-rose-500" />
              {userStats.streak} Days
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Current Rank Title
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">
              {levelInfo.title}
            </div>
            <span className="text-[11px] text-slate-400">Level {levelInfo.level}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Completed Mocks
            </span>
            <div className="text-2xl font-black text-blue-600 dark:text-sky-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5" />
              {userStats.completedTestsCount}
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>Progress to Level {levelInfo.level + 1}</span>
            <span>
              {levelInfo.currentXp - levelInfo.xpForCurrentLevel} /{" "}
              {levelInfo.xpForNextLevel - levelInfo.xpForCurrentLevel} XP (
              {levelInfo.progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="pt-2 flex flex-wrap gap-3">
          <Link
            to="/library"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
          >
            <Play className="w-4 h-4 fill-white" />
            Practice a Mock Test
          </Link>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-bold text-xs rounded-xl transition-colors"
          >
            View Your Test Analytics
          </Link>
        </div>
      </div>
    </div>
  );
};

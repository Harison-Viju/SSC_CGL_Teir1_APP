/**
 * Dedicated Leaderboard View: Full page experience with League rules,
 * Hall of Fame, peer competition, and quick drill shortcuts.
 */

import React from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Flame,
  Zap,
  Target,
  ArrowRight,
  Shield,
  HelpCircle,
  Play,
  TrendingUp,
} from "lucide-react";
import { Leaderboard } from "../components/Leaderboard";
import { useAppStore } from "../store/useAppStore";

export const LeaderboardView: React.FC = () => {
  const { userStats } = useAppStore();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-16 space-y-10">
      {/* Main Leaderboard Interactive Area */}
      <Leaderboard />

      {/* Educational Guide: How Leagues & Promotion Work */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            How ExamQuest Leagues & XP Work
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Modeled after competitive exam preparation dynamics and Duolingo-style leagues to build
            unshakable daily consistency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Rule 1 */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-sm">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Earning Experience (XP)
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Earn <span className="font-semibold text-slate-900 dark:text-slate-200">+10 XP</span>{" "}
              per correct answer in full mocks,{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-200">+25 XP</span> for
              completing a 10-question practice drill, and{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-200">+50 XP</span> for
              completing a full 100-question mock.
            </p>
          </div>

          {/* Rule 2 */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Weekly Promotion & Demotion
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every Sunday at 23:59 IST, the top 5 aspirants in the Weekly League promote to the next
              tier (Bronze → Silver → Gold → Platinum → Diamond). The bottom 3 risk relegation.
            </p>
          </div>

          {/* Rule 3 */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-sm">
              <Flame className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Streak Freeze & Multipliers
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Maintain your daily practice streak to unlock multiplier bonuses. A 7-day streak awards
              a 1.25x XP boost across all practice questions!
            </p>
          </div>
        </div>

        {/* Action card */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Ready to overtake the next aspirant? Start a timed section drill or full-length paper.
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/library"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-transform hover:scale-105 shadow-md shadow-blue-500/20"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Take Full Mock Test
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

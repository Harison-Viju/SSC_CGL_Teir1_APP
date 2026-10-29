/**
 * Leaderboard Component: Gamified rankings, podium display, league tiers,
 * promotion/demotion indicators, and interactive student profiles.
 */

import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Crown,
  Medal,
  Award,
  ChevronRight,
  Sparkles,
  Target,
  ArrowUpRight,
  ShieldCheck,
  X,
  Play,
  Clock,
  Layers,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { Mascot } from "./Mascot";
import {
  PEER_ASPIRANTS,
  getLeagueTier,
  getTierColor,
} from "../data/mockLeaderboard";
import { LeaderboardEntry, LeagueTier } from "../types";

type TimeframeFilter = "weekly" | "allTime" | "mockScore";

interface LeaderboardProps {
  compact?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ compact = false }) => {
  const { userStats } = useAppStore();
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("weekly");
  const [selectedTier, setSelectedTier] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<LeaderboardEntry | null>(null);

  // Synthesize current user's entry based on real store stats
  const currentUserEntry: LeaderboardEntry = useMemo(() => {
    const accuracy =
      userStats.totalAnswered > 0
        ? Math.round((userStats.totalCorrect / userStats.totalAnswered) * 1000) / 10
        : 88.0;

    // Approximate mock score if tests completed or default to realistic baseline
    const calculatedMock =
      userStats.completedTestsCount > 0
        ? Math.min(195, Math.max(80, Math.round((userStats.xp / 10) * 10) / 10))
        : 148.5;

    const userTier = getLeagueTier(userStats.xp);

    return {
      id: "current_user",
      name: "You (Aspirant)",
      avatarBg: "from-blue-600 via-indigo-600 to-sky-600",
      initials: "ME",
      location: "India",
      targetPost: "SSC CGL Aspirant · Target 160+",
      xp: userStats.xp,
      weeklyXp: Math.min(userStats.xp, Math.round(userStats.xp * 0.45) + 80),
      mockScore: calculatedMock,
      maxScore: 200,
      streak: userStats.streak || 1,
      tier: userTier,
      accuracy: accuracy,
      testsCompleted: userStats.completedTestsCount,
      rankDelta: 2,
      isCurrentUser: true,
      badges: ["Daily Warrior", "ExamQuest Aspirant"],
      breakdown: {
        reasoning: 42.0,
        ga: 32.5,
        quants: 41.0,
        english: 38.0,
      },
    };
  }, [userStats]);

  // Combine peer cohort with current user and sort according to timeframe
  const allEntries = useMemo(() => {
    const combined = [...PEER_ASPIRANTS, currentUserEntry];

    // Sort according to timeframe
    if (timeframe === "weekly") {
      combined.sort((a, b) => b.weeklyXp - a.weeklyXp);
    } else if (timeframe === "allTime") {
      combined.sort((a, b) => b.xp - a.xp);
    } else {
      combined.sort((a, b) => b.mockScore - a.mockScore);
    }

    return combined;
  }, [currentUserEntry, timeframe]);

  // Compute actual ranks across all entries
  const rankedEntries = useMemo(() => {
    return allEntries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }, [allEntries]);

  // Find user's current ranking info
  const userRank = useMemo(() => {
    const found = rankedEntries.find((e) => e.isCurrentUser);
    return found ? found.rank : 1;
  }, [rankedEntries]);

  // Next aspirant above current user
  const nextAboveUser = useMemo(() => {
    if (userRank <= 1) return null;
    return rankedEntries[userRank - 2];
  }, [rankedEntries, userRank]);

  // Filtered entries for search / tier
  const filteredEntries = useMemo(() => {
    return rankedEntries.filter((entry) => {
      const matchesSearch =
        entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.targetPost.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTier =
        selectedTier === "All" || entry.tier.toLowerCase() === selectedTier.toLowerCase();

      return matchesSearch && matchesTier;
    });
  }, [rankedEntries, searchQuery, selectedTier]);

  const topThree = rankedEntries.slice(0, 3);
  const displayList = compact ? filteredEntries.slice(0, 5) : filteredEntries;

  // Mascot dynamic advice
  const mascotAdvice = useMemo(() => {
    if (userRank === 1) {
      return {
        state: "celebrate" as const,
        msg: "All India Rank 1! You are leading the entire league! Keep defending your spot!",
      };
    }
    if (userRank <= 3) {
      return {
        state: "cheer" as const,
        msg: `Rank #${userRank}! You're on the podium! One more practice set can take you to the top!`,
      };
    }
    if (userRank <= 5) {
      return {
        state: "happy" as const,
        msg: `Rank #${userRank}! You're inside the Promotion Zone to the next tier! Keep going!`,
      };
    }
    if (nextAboveUser) {
      const diff =
        timeframe === "weekly"
          ? nextAboveUser.weeklyXp - currentUserEntry.weeklyXp + 10
          : timeframe === "allTime"
          ? nextAboveUser.xp - currentUserEntry.xp + 10
          : Math.round((nextAboveUser.mockScore - currentUserEntry.mockScore) * 10) / 10;

      const metric = timeframe === "mockScore" ? "marks" : "XP";
      return {
        state: "focus" as const,
        msg: `Only ${diff} ${metric} behind ${nextAboveUser.name}! Complete a practice drill to overtake them!`,
      };
    }
    return {
      state: "calm" as const,
      msg: "Consistency is key. Daily practice adds up to dramatic score jumps!",
    };
  }, [userRank, nextAboveUser, timeframe, currentUserEntry]);

  return (
    <div className="space-y-6">
      {/* Top Banner / User Rank Highlight */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden text-white">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Left stats column */}
          <div className="flex-1 space-y-4 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                SSC CGL Aspirants League
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Resets in <span className="text-slate-200 font-semibold font-mono">3d 14h</span>
              </div>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Live Performance Leaderboard
              </h2>
              <p className="text-slate-300 text-sm mt-1 max-w-xl">
                Compete with serious aspirants preparing for SSC CGL 2024–2025. Climb the leagues by
                earning XP in full mocks and speed drills.
              </p>
            </div>

            {/* User Standing Quick Bar */}
            <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-4 p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-md">
              <div className="flex items-center gap-2.5 px-2">
                <span className="text-xs text-slate-400 font-medium">Your Rank:</span>
                <span className="text-lg font-extrabold font-mono text-amber-400">
                  #{userRank}
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  of {rankedEntries.length}
                </span>
              </div>

              <div className="h-4 w-px bg-slate-700" />

              <div className="flex items-center gap-2 px-2">
                <span className="text-xs text-slate-400 font-medium">Current Tier:</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    getTierColor(currentUserEntry.tier).badge
                  }`}
                >
                  {currentUserEntry.tier} League
                </span>
              </div>

              <div className="h-4 w-px bg-slate-700" />

              <div className="flex items-center gap-1.5 px-2">
                <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
                <span className="text-xs font-semibold font-mono text-slate-200">
                  {currentUserEntry.streak}d Streak
                </span>
              </div>

              <div className="h-4 w-px bg-slate-700" />

              <div className="flex items-center gap-1.5 px-2">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-semibold font-mono text-slate-200">
                  {timeframe === "weekly"
                    ? `${currentUserEntry.weeklyXp} Wk XP`
                    : timeframe === "allTime"
                    ? `${currentUserEntry.xp} Total XP`
                    : `${currentUserEntry.mockScore} / 200`}
                </span>
              </div>
            </div>
          </div>

          {/* Right column: Mascot cheer box */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <Mascot
              state={mascotAdvice.state}
              size="md"
              message={mascotAdvice.msg}
              className="scale-95 sm:scale-100"
            />
          </div>
        </div>
      </div>

      {/* Podium Display (Top 3 Performers) */}
      {!compact && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="text-center max-w-md mx-auto mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
              <Crown className="w-5 h-5 text-amber-500 fill-amber-500" />
              Podium of Top Aspirants
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {timeframe === "weekly"
                ? "Top scorers this week leading the promotion sprint"
                : timeframe === "allTime"
                ? "All-time highest cumulative XP achievers"
                : "Highest mock exam raw scores recorded"}
            </p>
          </div>

          {/* 3 Columns Podium Layout */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-2xl mx-auto pt-6 pb-2">
            {/* Rank 2 (Silver) */}
            {topThree[1] && (
              <div
                onClick={() => setSelectedStudent(topThree[1])}
                className="flex flex-col items-center cursor-pointer group transition-transform hover:-translate-y-1"
              >
                <div className="relative mb-2">
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr ${topThree[1].avatarBg} text-white font-bold text-lg sm:text-xl flex items-center justify-center shadow-lg ring-4 ring-slate-300 dark:ring-slate-700`}
                  >
                    {topThree[1].initials}
                  </div>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow border border-white dark:border-slate-600">
                    #2
                  </div>
                </div>

                <div className="text-center w-full px-1">
                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    {topThree[1].name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {topThree[1].location.split(",")[0]}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {timeframe === "mockScore"
                      ? `${topThree[1].mockScore}`
                      : `${timeframe === "weekly" ? topThree[1].weeklyXp : topThree[1].xp} XP`}
                  </div>
                </div>

                {/* Silver Pillar */}
                <div className="w-full mt-3 bg-gradient-to-t from-slate-300/80 via-slate-200/90 to-slate-100/90 dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-700/60 rounded-t-2xl border-t-2 border-slate-300 dark:border-slate-600 h-28 sm:h-32 flex flex-col items-center justify-center shadow-inner">
                  <Medal className="w-6 h-6 text-slate-500 dark:text-slate-300" />
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 mt-1">
                    SILVER
                  </span>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold - Elevated) */}
            {topThree[0] && (
              <div
                onClick={() => setSelectedStudent(topThree[0])}
                className="flex flex-col items-center cursor-pointer group transition-transform hover:-translate-y-1.5"
              >
                <div className="relative mb-2">
                  <Crown className="w-6 h-6 text-amber-500 fill-amber-400 absolute -top-5 left-1/2 -translate-x-1/2 drop-shadow-md animate-bounce" />
                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr ${topThree[0].avatarBg} text-white font-extrabold text-xl sm:text-2xl flex items-center justify-center shadow-xl ring-4 ring-amber-400 dark:ring-amber-500`}
                  >
                    {topThree[0].initials}
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full shadow-md">
                    #1
                  </div>
                </div>

                <div className="text-center w-full px-1">
                  <div className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {topThree[0].name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {topThree[0].location.split(",")[0]}
                  </div>
                  <div className="text-sm font-mono font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {timeframe === "mockScore"
                      ? `${topThree[0].mockScore} / 200`
                      : `${timeframe === "weekly" ? topThree[0].weeklyXp : topThree[0].xp} XP`}
                  </div>
                </div>

                {/* Gold Pillar */}
                <div className="w-full mt-3 bg-gradient-to-t from-amber-400/30 via-amber-300/40 to-amber-200/50 dark:from-amber-950/60 dark:via-amber-900/40 dark:to-amber-700/40 rounded-t-2xl border-t-4 border-amber-400 h-36 sm:h-44 flex flex-col items-center justify-center shadow-md">
                  <Trophy className="w-8 h-8 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-black tracking-wider text-amber-800 dark:text-amber-300 mt-1">
                    LEADER
                  </span>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {topThree[2] && (
              <div
                onClick={() => setSelectedStudent(topThree[2])}
                className="flex flex-col items-center cursor-pointer group transition-transform hover:-translate-y-1"
              >
                <div className="relative mb-2">
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr ${topThree[2].avatarBg} text-white font-bold text-lg sm:text-xl flex items-center justify-center shadow-lg ring-4 ring-amber-700/40 dark:ring-amber-700/60`}
                  >
                    {topThree[2].initials}
                  </div>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-800 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow border border-white dark:border-amber-900">
                    #3
                  </div>
                </div>

                <div className="text-center w-full px-1">
                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    {topThree[2].name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {topThree[2].location.split(",")[0]}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {timeframe === "mockScore"
                      ? `${topThree[2].mockScore}`
                      : `${timeframe === "weekly" ? topThree[2].weeklyXp : topThree[2].xp} XP`}
                  </div>
                </div>

                {/* Bronze Pillar */}
                <div className="w-full mt-3 bg-gradient-to-t from-amber-900/20 via-amber-800/20 to-amber-700/30 dark:from-amber-950/80 dark:via-amber-950/60 dark:to-amber-900/40 rounded-t-2xl border-t-2 border-amber-700 h-24 sm:h-28 flex flex-col items-center justify-center shadow-inner">
                  <Medal className="w-6 h-6 text-amber-700 dark:text-amber-500" />
                  <span className="text-xs font-extrabold text-amber-800 dark:text-amber-400 mt-1">
                    BRONZE
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Control Bar: Timeframe Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Segmented Timeframe Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 self-start">
          <button
            onClick={() => setTimeframe("weekly")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              timeframe === "weekly"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Weekly League
          </button>
          <button
            onClick={() => setTimeframe("allTime")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              timeframe === "allTime"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All-Time XP
          </button>
          <button
            onClick={() => setTimeframe("mockScore")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              timeframe === "mockScore"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Best Mock Score
          </button>
        </div>

        {/* Tier filter pills and search bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* League Dropdown / Tier Filter */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {["All", "Diamond", "Platinum", "Gold", "Silver", "Bronze"].map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  selectedTier === tier
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tier}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative min-w-[200px] flex-1 md:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search aspirant or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Table Column Header */}
        <div className="grid grid-cols-12 gap-2 px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
          <div className="col-span-6 sm:col-span-5 md:col-span-4">Aspirant</div>
          <div className="hidden sm:block sm:col-span-2 text-center">League</div>
          <div className="hidden md:block md:col-span-2 text-center">Streak & Accuracy</div>
          <div className="col-span-4 sm:col-span-2 md:col-span-3 text-right">
            {timeframe === "mockScore" ? "Mock Score" : "Score / XP"}
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {displayList.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No aspirants found matching filters.</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedTier("All");
                }}
                className="mt-3 text-xs text-blue-600 dark:text-sky-400 hover:underline font-bold"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            displayList.map((entry, index) => {
              const isUser = entry.isCurrentUser;
              const isTop3 = entry.rank <= 3;
              const isPromotionBoundary = timeframe === "weekly" && entry.rank === 5;
              const isDemotionBoundary =
                timeframe === "weekly" && entry.rank === rankedEntries.length - 3;

              return (
                <React.Fragment key={entry.id}>
                  <div
                    onClick={() => setSelectedStudent(entry)}
                    className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center cursor-pointer transition-colors relative ${
                      isUser
                        ? "bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-blue-600 dark:border-sky-400 font-semibold"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    {/* Rank Indicator */}
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1">
                      {entry.rank === 1 ? (
                        <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                          1
                        </div>
                      ) : entry.rank === 2 ? (
                        <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                          2
                        </div>
                      ) : entry.rank === 3 ? (
                        <div className="w-7 h-7 rounded-full bg-amber-800 text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                          3
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-sm text-slate-600 dark:text-slate-400">
                          #{entry.rank}
                        </span>
                      )}
                    </div>

                    {/* Aspirant Details */}
                    <div className="col-span-6 sm:col-span-5 md:col-span-4 flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${entry.avatarBg} text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm`}
                      >
                        {entry.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm truncate ${
                              isUser
                                ? "font-extrabold text-blue-600 dark:text-sky-400"
                                : "font-bold text-slate-900 dark:text-white"
                            }`}
                          >
                            {entry.name}
                          </span>
                          {isUser && (
                            <span className="text-[10px] bg-blue-600 text-white font-black px-1.5 py-0.2 rounded-md uppercase">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {entry.targetPost} · {entry.location.split(",")[0]}
                        </div>
                      </div>
                    </div>

                    {/* League Tier */}
                    <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                          getTierColor(entry.tier).badge
                        }`}
                      >
                        {entry.tier}
                      </span>
                    </div>

                    {/* Streak & Accuracy */}
                    <div className="hidden md:flex md:col-span-2 items-center justify-center gap-4 text-xs">
                      <div className="flex items-center gap-1 text-orange-500 font-bold font-mono">
                        <Flame className="w-3.5 h-3.5 fill-orange-500" />
                        {entry.streak}d
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono">
                        {entry.accuracy}% acc
                      </div>
                    </div>

                    {/* Score / XP Column */}
                    <div className="col-span-4 sm:col-span-2 md:col-span-3 text-right">
                      {timeframe === "mockScore" ? (
                        <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                          {entry.mockScore}{" "}
                          <span className="text-[11px] font-normal text-slate-400">/ 200</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          {timeframe === "weekly" ? entry.weeklyXp : entry.xp}
                          <span className="text-[11px] font-normal text-slate-400">XP</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Promotion Zone Divider Marker */}
                  {isPromotionBoundary && (
                    <div className="px-5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border-y border-emerald-200 dark:border-emerald-800/60 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>▲ PROMOTION ZONE (Top 5 will be promoted to higher league)</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono">Safe</span>
                    </div>
                  )}

                  {/* Demotion Zone Divider Marker */}
                  {isDemotionBoundary && (
                    <div className="px-5 py-1.5 bg-rose-50 dark:bg-rose-950/40 border-y border-rose-200 dark:border-rose-800/60 text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>▼ RELEGATION DANGER ZONE (Bottom 3 demote next Sunday)</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono">Danger</span>
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer info strip */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Fair play verified · Ranks refresh after every mock submission & drill.</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/practice/tier1_sample_1"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-transform hover:scale-105"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Practice Drill (+25 XP)
            </Link>
          </div>
        </div>
      </div>

      {/* Student Details Inspection Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden space-y-6">
            {/* Close button */}
            <button
              onClick={() => setSelectedStudent(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${selectedStudent.avatarBg} text-white font-extrabold text-2xl flex items-center justify-center shadow-lg ring-4 ring-slate-100 dark:ring-slate-800`}
              >
                {selectedStudent.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white truncate">
                    {selectedStudent.name}
                  </h3>
                  {selectedStudent.isCurrentUser && (
                    <span className="text-[10px] bg-blue-600 text-white font-black px-1.5 py-0.5 rounded uppercase">
                      YOU
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {selectedStudent.targetPost}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {selectedStudent.location}
                </p>
              </div>
            </div>

            {/* Core Stats Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Rank</span>
                <span className="text-base font-extrabold font-mono text-amber-500">
                  #{selectedStudent.rank}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">
                  Total XP
                </span>
                <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                  {selectedStudent.xp}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Streak</span>
                <span className="text-base font-extrabold font-mono text-orange-500 flex items-center justify-center gap-0.5">
                  <Flame className="w-4 h-4 fill-orange-500" />
                  {selectedStudent.streak}d
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">
                  Accuracy
                </span>
                <span className="text-base font-extrabold font-mono text-emerald-500">
                  {selectedStudent.accuracy}%
                </span>
              </div>
            </div>

            {/* 4-Section Estimated Strengths */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tier-1 Mock Section Strengths (Marks / 50)
              </h4>
              <div className="space-y-2">
                {[
                  {
                    name: "General Intelligence & Reasoning",
                    val: selectedStudent.breakdown.reasoning,
                    color: "bg-blue-500",
                  },
                  {
                    name: "General Awareness (GK/GS)",
                    val: selectedStudent.breakdown.ga,
                    color: "bg-amber-500",
                  },
                  {
                    name: "Quantitative Aptitude (Maths)",
                    val: selectedStudent.breakdown.quants,
                    color: "bg-emerald-500",
                  },
                  {
                    name: "English Comprehension",
                    val: selectedStudent.breakdown.english,
                    color: "bg-purple-500",
                  },
                ].map((s) => (
                  <div key={s.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span>{s.name}</span>
                      <span className="font-mono">{s.val} / 50</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${s.color} rounded-full transition-all`}
                        style={{ width: `${(s.val / 50) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Badges */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Earned Honors
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedStudent.badges.map((badge) => (
                  <div
                    key={badge}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    {badge}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Bottom CTA */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

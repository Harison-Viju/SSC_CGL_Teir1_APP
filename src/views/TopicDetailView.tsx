/**
 * TopicDetailView: Topic overview screen showing mastery stats,
 * filters (All/Unseen/Wrong/Bookmarked), count picker (10/20/30/all),
 * and three mode cards (Learn, Topic Test [coming next], Sprint [placeholder]).
 */

import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Timer,
  Zap,
  CheckCircle2,
  Bookmark,
  AlertCircle,
  HelpCircle,
  Play,
  Flame,
  Award,
} from "lucide-react";
import { Mascot } from "../components/Mascot";
import { fetchAllTopics, fetchAllQuestions, getStatsMap } from "../utils/questionsLoader";
import { getTopicStats, pickQuestions, slugify } from "../utils/topicStats";
import { db } from "../db";
import type { TopicMeta, Question, QuestionStat, TopicStatsResult } from "../types";

export const TopicDetailView: React.FC = () => {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();

  const [topic, setTopic] = useState<TopicMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, QuestionStat>>({});
  const [bookmarkedKeys, setBookmarkedKeys] = useState<Set<string>>(new Set());
  const [flaggedKeys, setFlaggedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Drill options
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "unseen" | "wrong" | "bookmarked"
  >("all");
  const [selectedCount, setSelectedCount] = useState<number | "all">(10);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchAllTopics(),
      fetchAllQuestions(),
      getStatsMap(),
      db.bookmarks.toArray(),
      db.flags.toArray(),
    ])
      .then(([tList, qList, sMap, bList, fList]) => {
        if (!mounted) return;
        const targetSlug = slugify(topicId || "");
        const foundTopic = tList.find(
          (t) => t.id === topicId || slugify(t.id) === targetSlug || slugify(t.name) === targetSlug
        );

        setTopic(
          foundTopic || {
            id: topicId || "unknown",
            name: (topicId || "Topic").replace(/-/g, " "),
            section: "reasoning",
            count: 0,
            uniqueCount: 0,
            small: false,
          }
        );

        // Filter questions belonging to this topic
        const topicQs = qList.filter((q) => {
          if (!q.topic) return false;
          return (
            slugify(q.topic) === targetSlug ||
            (foundTopic && slugify(q.topic) === slugify(foundTopic.name))
          );
        });

        // Collect bookmarked keys
        const bSet = new Set<string>();
        for (const b of bList) {
          const matchedQ = topicQs.find((q) => q.n === b.qNum && (!b.testId || (q as any).testId === b.testId));
          if (matchedQ?.qkey) bSet.add(matchedQ.qkey);
        }

        // Collect flagged keys
        const fSet = new Set<string>();
        for (const f of fList) {
          const matchedQ = topicQs.find((q) => q.n === f.qNum && (!f.testId || (q as any).testId === f.testId));
          if (matchedQ?.qkey) fSet.add(matchedQ.qkey);
        }

        setQuestions(topicQs);
        setStatsMap(sMap);
        setBookmarkedKeys(bSet);
        setFlaggedKeys(fSet);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load topic detail:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [topicId]);

  // Topic mastery stats
  const stats: TopicStatsResult = useMemo(() => {
    return getTopicStats(topicId || "", questions, statsMap);
  }, [topicId, questions, statsMap]);

  // Questions matching current filter
  const matchingQuestions = useMemo(() => {
    if (questions.length === 0) return [];
    return pickQuestions({
      questions,
      topicId: topicId || "",
      filter: selectedFilter,
      statsMap,
      bookmarkedKeys,
      flaggedKeys,
      count: 9999, // get full filtered pool
    });
  }, [questions, topicId, selectedFilter, statsMap, bookmarkedKeys, flaggedKeys]);

  const handleStartLearn = () => {
    const countParam = selectedCount === "all" ? 0 : selectedCount;
    navigate(`/train/${topicId}/learn?filter=${selectedFilter}&count=${countParam}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <Mascot state="thinking" size="md" message="Loading topic details..." />
        <p className="mt-4 text-sm text-slate-500 font-medium animate-pulse">
          Gathering previous-year questions and personal history...
        </p>
      </div>
    );
  }

  const sectionName =
    topic?.section === "reasoning"
      ? "General Intelligence & Reasoning"
      : topic?.section === "general_awareness"
      ? "General Awareness"
      : topic?.section === "quantitative_aptitude"
      ? "Quantitative Aptitude"
      : "English Comprehension";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/train"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Topics</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Title & Section */}
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-400 border border-blue-200 dark:border-blue-800">
              {sectionName}
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
              {topic?.name}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {questions.length} authentic previous-year questions available for practice.
            </p>
          </div>

          {/* Mastery Snapshot */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-w-[260px]">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
              <span>TOPIC MASTERY</span>
              <span
                className={
                  stats.masteryLevel === 3
                    ? "text-emerald-600 dark:text-emerald-400"
                    : stats.masteryLevel === 2
                    ? "text-amber-600 dark:text-amber-400"
                    : stats.masteryLevel === 1
                    ? "text-rose-500 dark:text-rose-400"
                    : "text-slate-400"
                }
              >
                {stats.masteryLevel === 3
                  ? "Level 3: Mastered"
                  : stats.masteryLevel === 2
                  ? "Level 2: Proficient"
                  : stats.masteryLevel === 1
                  ? "Level 1: Practicing"
                  : "Level 0: Not Started"}
              </span>
            </div>

            {/* 4-segment mastery gauge */}
            <div className="grid grid-cols-4 gap-1.5 h-2.5 mb-3">
              {[1, 2, 3, 4].map((seg) => {
                const active =
                  stats.masteryLevel === 3
                    ? true
                    : stats.masteryLevel === 2
                    ? seg <= 2
                    : stats.masteryLevel === 1
                    ? seg === 1
                    : false;

                let colorClass = "bg-slate-200 dark:bg-slate-700";
                if (active) {
                  if (stats.masteryLevel === 3) colorClass = "bg-emerald-500";
                  else if (stats.masteryLevel === 2) colorClass = "bg-amber-500";
                  else if (stats.masteryLevel === 1) colorClass = "bg-rose-500";
                }

                return <div key={seg} className={`h-full rounded-sm ${colorClass}`} />;
              })}
            </div>

            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>
                Attempted: <strong className="text-slate-900 dark:text-white">{stats.attempted} / {stats.total}</strong>
              </span>
              <span>
                Accuracy:{" "}
                <strong
                  className={
                    stats.attempted > 0
                      ? stats.accuracy >= 80
                        ? "text-emerald-600 dark:text-emerald-400"
                        : stats.accuracy >= 50
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400"
                      : "text-slate-400"
                  }
                >
                  {stats.attempted > 0 ? `${stats.accuracy}%` : "0%"}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Practice Configuration Bar (Filters + Count Picker) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Question Pool Filter */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Filter Questions
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: "All Questions" },
                  { id: "unseen", label: "Unseen Only" },
                  { id: "wrong", label: "Wrong Before" },
                  { id: "bookmarked", label: "Bookmarked" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    selectedFilter === f.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question Count Picker */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Question Count
            </span>
            <div className="flex items-center gap-1.5">
              {([10, 20, 30, "all"] as const).map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => setSelectedCount(cnt)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    selectedCount === cnt
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {cnt === "all" ? "All" : cnt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Matching count indicator */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Pool: <strong className="text-slate-900 dark:text-white">{matchingQuestions.length}</strong> questions match your criteria
          </span>
          {matchingQuestions.length === 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              No questions found for this filter. Switch to "All Questions".
            </span>
          )}
        </div>
      </div>

      {/* Three Mode Cards: Learn, Topic Test, Sprint */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Mode 1: Learn Mode (Active) */}
        <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/40 dark:border-blue-500/50 rounded-3xl p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-l from-blue-600 to-indigo-600 text-white font-extrabold text-[10px] rounded-bl-xl uppercase tracking-wider">
            Ready to Play
          </div>

          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-sky-400 mb-4">
              <Sparkles className="w-6 h-6 text-amber-500" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Learn Mode
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Understand concepts with bite-sized practice, step-by-step questions, instant feedback, and Quizzy mascot encouragement.
            </p>

            <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Instant explanation on every question</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Zero timer pressure — study at your pace</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Earn XP and build your daily streak</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleStartLearn}
              disabled={matchingQuestions.length === 0}
              className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] ${
                matchingQuestions.length === 0
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25"
              }`}
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Learn Mode</span>
            </button>
          </div>
        </div>

        {/* Mode 2: Topic Test (Coming Next) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
              <Timer className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Topic Test
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Standard exam simulation on this single topic. Fast-paced timed drills matching SSC speed.
            </p>

            <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>36 seconds per question (SSC pace)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Official marking (+2.0 / -0.5)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Results and scorecard at the end</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              disabled
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700"
            >
              Coming Next
            </button>
          </div>
        </div>

        {/* Mode 3: Sprint Mode (Placeholder) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
              <Zap className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Sprint Mode
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Rapid-fire challenge against the clock! How many can you answer in 5, 10, or 15 minutes?
            </p>

            <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Rapid auto-advance after 0.6s feedback</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Survival toggle: 3 lives run</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Personal best tracking per topic</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              disabled
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700"
            >
              Coming in P5
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

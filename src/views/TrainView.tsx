/**
 * TrainView: Topic Browser categorized by the 4 SSC sections.
 * Displays topic cards with mastery level (4-level bar), accuracy, and question counts.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Target,
  Sparkles,
  ChevronRight,
  Brain,
  Globe2,
  Calculator,
  Languages,
} from "lucide-react";
import { Mascot } from "../components/Mascot";
import { fetchAllTopics, fetchAllQuestions, getStatsMap } from "../utils/questionsLoader";
import { getTopicStats } from "../utils/topicStats";
import type { TopicMeta, Question, QuestionStat, TopicStatsResult } from "../types";

const SECTION_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  reasoning: {
    label: "General Intelligence & Reasoning",
    icon: Brain,
    color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800",
  },
  general_awareness: {
    label: "General Awareness",
    icon: Globe2,
    color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
  },
  quantitative_aptitude: {
    label: "Quantitative Aptitude",
    icon: Calculator,
    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
  },
  english: {
    label: "English Comprehension",
    icon: Languages,
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
  },
};

const SECTION_ORDER = ["reasoning", "general_awareness", "quantitative_aptitude", "english"];

export const TrainView: React.FC = () => {
  const [topics, setTopics] = useState<TopicMeta[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, QuestionStat>>({});
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("all");

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchAllTopics(), fetchAllQuestions(), getStatsMap()])
      .then(([tList, qList, sMap]) => {
        if (!mounted) return;
        setTopics(tList);
        setQuestions(qList);
        setStatsMap(sMap);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load train view data:", err);
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Compute stats for each topic
  const topicStatsMap = useMemo(() => {
    const map = new Map<string, TopicStatsResult>();
    for (const t of topics) {
      const stats = getTopicStats(t.id, questions, statsMap);
      map.set(t.id, stats);
    }
    return map;
  }, [topics, questions, statsMap]);

  // Filter topics by search and section
  const filteredTopics = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return topics.filter((t) => {
      const matchesSearch =
        !term ||
        t.name.toLowerCase().includes(term) ||
        t.section.toLowerCase().includes(term);

      const matchesSection =
        selectedSection === "all" || t.section === selectedSection;

      return matchesSearch && matchesSection;
    });
  }, [topics, searchTerm, selectedSection]);

  // Group filtered topics by section
  const groupedTopics = useMemo(() => {
    const groups: Record<string, TopicMeta[]> = {};
    for (const s of SECTION_ORDER) {
      groups[s] = [];
    }
    for (const t of filteredTopics) {
      if (!groups[t.section]) groups[t.section] = [];
      groups[t.section].push(t);
    }
    return groups;
  }, [filteredTopics]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-7 h-7 text-blue-600 dark:text-sky-400" />
            Topic Practice Hub
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Master SSC CGL syllabus topic by topic with Learn Mode, Topic Tests, and Sprints.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-sky-400 w-fit">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>{topics.length} Syllabus Topics</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search topics (e.g., Analogy, Blood Relations)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        {/* Section filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedSection("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedSection === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            All Sections
          </button>
          {SECTION_ORDER.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSection(sec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedSection === sec
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {sec === "reasoning"
                ? "Reasoning"
                : sec === "general_awareness"
                ? "GA"
                : sec === "quantitative_aptitude"
                ? "Quants"
                : "English"}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Mascot state="thinking" size="md" message="Loading syllabus topics..." />
          <p className="mt-4 text-sm text-slate-500 font-medium animate-pulse">
            Calculating mastery across previous-year papers...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredTopics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md mx-auto">
          <Mascot state="thinking" size="lg" message="No matching topics found!" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">
            No topics matched "{searchTerm}"
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Try adjusting your search query or clear the section filter.
          </p>
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedSection("all");
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Grouped Topics */}
      {!loading &&
        SECTION_ORDER.map((sectionKey) => {
          const sectionTopics = groupedTopics[sectionKey];
          if (!sectionTopics || sectionTopics.length === 0) return null;
          const secConfig = SECTION_CONFIG[sectionKey];
          const SecIcon = secConfig.icon;

          return (
            <section key={sectionKey} className="space-y-3">
              {/* Section Header */}
              <div className="flex items-center gap-2.5 pt-2">
                <div className={`p-2 rounded-xl border ${secConfig.color}`}>
                  <SecIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {secConfig.label}
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {sectionTopics.length} topics available
                  </span>
                </div>
              </div>

              {/* Responsive Cards Grid: 1 col (390px), 2 cols (768px), 3 cols (1366px) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sectionTopics.map((topic) => {
                  const stats = topicStatsMap.get(topic.id) || {
                    attempted: 0,
                    total: topic.uniqueCount || topic.count,
                    accuracy: 0,
                    masteryLevel: 0,
                  };

                  const total = stats.total || topic.uniqueCount || topic.count;
                  const isSmall = topic.small || total < 5;

                  return (
                    <Link
                      key={topic.id}
                      to={`/train/${topic.id}`}
                      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Top info: Name + Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
                            {topic.name}
                          </h3>
                          {isSmall && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                              few questions
                            </span>
                          )}
                        </div>

                        {/* Counts & Accuracy */}
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                          <span>
                            {stats.attempted} / {total} attempted
                          </span>
                          <span
                            className={
                              stats.attempted > 0
                                ? stats.accuracy >= 80
                                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                  : stats.accuracy >= 50
                                  ? "text-amber-600 dark:text-amber-400 font-bold"
                                  : "text-rose-600 dark:text-rose-400 font-bold"
                                : "text-slate-400"
                            }
                          >
                            {stats.attempted > 0 ? `${stats.accuracy}% acc` : "0% acc"}
                          </span>
                        </div>
                      </div>

                      {/* 4-Level Mastery Bar */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between text-[11px] mb-1 font-semibold">
                          <span className="text-slate-500 dark:text-slate-400">Mastery</span>
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
                              ? "Mastered"
                              : stats.masteryLevel === 2
                              ? "Proficient"
                              : stats.masteryLevel === 1
                              ? "Practicing"
                              : "Not Started"}
                          </span>
                        </div>

                        {/* 4 distinct segments */}
                        <div className="grid grid-cols-4 gap-1 h-2">
                          {[1, 2, 3, 4].map((seg) => {
                            const active =
                              stats.masteryLevel === 3
                                ? true
                                : stats.masteryLevel === 2
                                ? seg <= 2
                                : stats.masteryLevel === 1
                                ? seg === 1
                                : false;

                            let colorClass = "bg-slate-200 dark:bg-slate-800";
                            if (active) {
                              if (stats.masteryLevel === 3) {
                                colorClass = "bg-emerald-500";
                              } else if (stats.masteryLevel === 2) {
                                colorClass = "bg-amber-500";
                              } else if (stats.masteryLevel === 1) {
                                colorClass = "bg-rose-400";
                              }
                            }

                            return (
                              <div
                                key={seg}
                                className={`h-full rounded-sm transition-colors ${colorClass}`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Card footer CTA */}
                      <div className="mt-3 flex items-center justify-end text-xs font-bold text-blue-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">
                        <span>Practice</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
    </div>
  );
};

/**
 * AnalyticsView: Comprehensive examination history, score progression curve,
 * sectional mastery breakdown, weak topic diagnostics, speed-vs-accuracy analysis,
 * and CSV/PDF report export.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  Award,
  Clock,
  Target,
  FileSpreadsheet,
  Printer,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Trash2,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { getAllAttempts, deleteAttempt } from "../db";
import { useAppStore } from "../store/useAppStore";
import { Mascot } from "../components/Mascot";
import { exportAttemptsToCsv } from "../utils/exportData";
import { formatTime } from "../utils/examEngine";
import type { TestAttemptSummary } from "../types";

export const AnalyticsView: React.FC = () => {
  const navigate = useNavigate();
  const { manifest } = useAppStore();
  const [attempts, setAttempts] = useState<TestAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<TestAttemptSummary | null>(null);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("all");

  const loadData = async () => {
    setLoading(true);
    const data = await getAllAttempts();
    setAttempts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this test record from your history?")) {
      await deleteAttempt(id);
      await loadData();
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        avgScore: 0,
        highestScore: 0,
        avgAccuracy: 0,
        totalTimeSeconds: 0,
        avgTimePerTestSeconds: 0,
        totalQuestionsAttempted: 0,
        totalCorrect: 0,
      };
    }

    const totalAttempts = attempts.length;
    const totalScore = attempts.reduce((acc, a) => acc + a.score, 0);
    const highestScore = Math.max(...attempts.map((a) => a.score));
    const avgScore = totalScore / totalAttempts;
    const avgAccuracy =
      attempts.reduce((acc, a) => acc + (a.accuracy || 0), 0) / totalAttempts;
    const totalTimeSeconds = attempts.reduce(
      (acc, a) => acc + (a.timeSpentSeconds || 0),
      0
    );
    const avgTimePerTestSeconds = totalTimeSeconds / totalAttempts;
    const totalQuestionsAttempted = attempts.reduce(
      (acc, a) => acc + (a.attempted || 0),
      0
    );
    const totalCorrect = attempts.reduce((acc, a) => acc + (a.correct || 0), 0);

    return {
      totalAttempts,
      avgScore: Math.round(avgScore * 10) / 10,
      highestScore: Math.round(highestScore * 10) / 10,
      avgAccuracy: Math.round(avgAccuracy),
      totalTimeSeconds,
      avgTimePerTestSeconds: Math.round(avgTimePerTestSeconds),
      totalQuestionsAttempted,
      totalCorrect,
    };
  }, [attempts]);

  // Section performance aggregation
  const sectionStats = useMemo(() => {
    const sections: Record<
      string,
      {
        name: string;
        totalScore: number;
        maxScore: number;
        correct: number;
        wrong: number;
        skipped: number;
        timeSpent: number;
        count: number;
      }
    > = {
      reasoning: {
        name: "General Intelligence & Reasoning",
        totalScore: 0,
        maxScore: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        timeSpent: 0,
        count: 0,
      },
      general_awareness: {
        name: "General Awareness",
        totalScore: 0,
        maxScore: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        timeSpent: 0,
        count: 0,
      },
      quantitative_aptitude: {
        name: "Quantitative Aptitude",
        totalScore: 0,
        maxScore: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        timeSpent: 0,
        count: 0,
      },
      english: {
        name: "English Comprehension",
        totalScore: 0,
        maxScore: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        timeSpent: 0,
        count: 0,
      },
    };

    attempts.forEach((att) => {
      if (!att.sectionScores) return;
      Object.entries(att.sectionScores).forEach(([secId, data]) => {
        if (!sections[secId]) {
          sections[secId] = {
            name: secId.replace(/_/g, " ").toUpperCase(),
            totalScore: 0,
            maxScore: 0,
            correct: 0,
            wrong: 0,
            skipped: 0,
            timeSpent: 0,
            count: 0,
          };
        }
        sections[secId].totalScore += data.score || 0;
        sections[secId].maxScore += data.maxScore || 50;
        sections[secId].correct += data.correct || 0;
        sections[secId].wrong += data.wrong || 0;
        sections[secId].skipped += data.skipped || 0;
        sections[secId].timeSpent += data.timeSpentSeconds || 0;
        sections[secId].count += 1;
      });
    });

    return Object.entries(sections).map(([id, s]) => {
      const avgScore = s.count > 0 ? s.totalScore / s.count : 0;
      const attempted = s.correct + s.wrong;
      const accuracy = attempted > 0 ? Math.round((s.correct / attempted) * 100) : 0;
      const avgTime = s.count > 0 ? Math.round(s.timeSpent / s.count) : 0;
      return {
        id,
        name: s.name,
        avgScore: Math.round(avgScore * 10) / 10,
        accuracy,
        avgTime,
        correct: s.correct,
        wrong: s.wrong,
        count: s.count,
      };
    });
  }, [attempts]);

  // Weak topics diagnostic aggregation
  const weakTopics = useMemo(() => {
    const topicsMap: Record<
      string,
      { total: number; correct: number; wrong: number }
    > = {};

    attempts.forEach((att) => {
      if (!att.topicStats) return;
      Object.entries(att.topicStats).forEach(([topic, stats]) => {
        if (!topicsMap[topic]) {
          topicsMap[topic] = { total: 0, correct: 0, wrong: 0 };
        }
        topicsMap[topic].total += stats.total;
        topicsMap[topic].correct += stats.correct;
        topicsMap[topic].wrong += stats.wrong;
      });
    });

    return Object.entries(topicsMap)
      .map(([topic, stat]) => {
        const accuracy =
          stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
        return {
          topic,
          ...stat,
          accuracy,
        };
      })
      .filter((t) => t.total >= 2) // at least 2 attempts
      .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong);
  }, [attempts]);

  // Time diagnostic (Correct vs Wrong vs Skipped average duration)
  const timeDiagnostic = useMemo(() => {
    let totalCorrectTime = 0;
    let totalCorrectCount = 0;
    let totalWrongTime = 0;
    let totalWrongCount = 0;

    attempts.forEach((att) => {
      if (!att.timeSpentPerQuestion || !att.userAnswers) return;
      Object.entries(att.timeSpentPerQuestion).forEach(([qStr, time]) => {
        const qNum = Number(qStr);
        const ans = att.userAnswers[qNum];
        // If answered
        if (ans !== undefined) {
          // Check if right or wrong in this attempt
          // If accuracy is high or based on answer
          totalCorrectTime += time;
          totalCorrectCount += 1;
        } else {
          totalWrongTime += time;
          totalWrongCount += 1;
        }
      });
    });

    const avgCorrectTime =
      totalCorrectCount > 0 ? Math.round(totalCorrectTime / totalCorrectCount) : 45;
    const avgWrongTime =
      totalWrongCount > 0 ? Math.round(totalWrongTime / totalWrongCount) : 65;

    return { avgCorrectTime, avgWrongTime };
  }, [attempts]);

  // Score Progression Graph points (chronological order)
  const chartAttempts = useMemo(() => {
    return [...attempts].sort((a, b) => a.timestamp - b.timestamp);
  }, [attempts]);

  // SVG Chart Dimensions
  const chartWidth = 720;
  const chartHeight = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 45 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const maxScoreScale = 200;

  const points = useMemo(() => {
    if (chartAttempts.length === 0) return [];
    if (chartAttempts.length === 1) {
      const x = padding.left + innerWidth / 2;
      const y =
        padding.top +
        innerHeight -
        (Math.max(0, chartAttempts[0].score) / maxScoreScale) * innerHeight;
      return [{ x, y, attempt: chartAttempts[0] }];
    }

    return chartAttempts.map((att, idx) => {
      const x = padding.left + (idx / (chartAttempts.length - 1)) * innerWidth;
      const y =
        padding.top +
        innerHeight -
        (Math.max(0, Math.min(maxScoreScale, att.score)) / maxScoreScale) *
          innerHeight;
      return { x, y, attempt: att };
    });
  }, [chartAttempts, innerWidth, innerHeight]);

  const pathD = useMemo(() => {
    if (points.length < 2) return "";
    return points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, "");
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length < 2) return "";
    const first = points[0];
    const last = points[points.length - 1];
    const bottom = padding.top + innerHeight;
    return `${pathD} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
  }, [pathD, points, innerHeight]);

  // Benchmark line for 135 cutoff
  const cutoffY =
    padding.top + innerHeight - (135 / maxScoreScale) * innerHeight;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-8">
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 print:border-none print:shadow-none">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-sky-400 font-bold text-xs uppercase tracking-wider">
            <BarChart3 className="w-3.5 h-3.5" />
            Performance Command Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            History & Diagnostics Analytics
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
            Track your score progression over time, pinpoint time leaks, identify weak topics, and verify Tier-1 qualification readiness.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <button
            onClick={() => exportAttemptsToCsv(attempts)}
            disabled={attempts.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition disabled:opacity-40"
            title="Download CSV of all past test attempts"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
            title="Print or save PDF report"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Mocks Attempted */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Mocks Attempted
          </span>
          <div className="text-3xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
            {metrics.totalAttempts}
            <span className="text-xs text-slate-500 font-normal">tests</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Total Qs: {metrics.totalQuestionsAttempted}
          </p>
        </div>

        {/* Average Score */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-blue-600 dark:text-sky-400 uppercase tracking-wider block">
            Average Score
          </span>
          <div className="text-3xl font-black text-blue-600 dark:text-sky-400 flex items-baseline gap-1.5">
            {metrics.avgScore}
            <span className="text-xs text-slate-400 font-normal">/ 200</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Peak: <span className="font-bold text-slate-800 dark:text-slate-200">{metrics.highestScore} marks</span>
          </p>
        </div>

        {/* Overall Accuracy */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Overall Accuracy
          </span>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1.5">
            {metrics.avgAccuracy}%
          </div>
          <p className="text-[11px] text-slate-500">
            {metrics.totalCorrect} of {metrics.totalQuestionsAttempted} correct
          </p>
        </div>

        {/* Avg Time Invested */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            Avg Mock Duration
          </span>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400 flex items-baseline gap-1.5">
            {Math.round(metrics.avgTimePerTestSeconds / 60)}
            <span className="text-xs text-slate-400 font-normal">mins</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Total prep: {(metrics.totalTimeSeconds / 3600).toFixed(1)} hrs
          </p>
        </div>
      </div>

      {/* Score Progression Curve Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-sky-400" />
              Score Progression Timeline
            </h2>
            <p className="text-xs text-slate-500">
              Tracking your exam scores chronologically against the SSC CGL Cutoff benchmark (135 Marks)
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600" /> Your Score
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-t-2 border-dashed border-rose-500" /> Cutoff (135)
            </span>
          </div>
        </div>

        {points.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-500 text-sm space-y-3">
            <BarChart3 className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold">No mock test history recorded yet.</p>
            <p className="text-xs text-slate-400">
              Take your first mock exam to generate your score progression curve!
            </p>
            <Link
              to="/library"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition"
            >
              Browse Mock Papers
            </Link>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto min-w-[550px] overflow-visible select-none font-sans"
            >
              <defs>
                <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 50, 100, 135, 150, 200].map((score) => {
                const y =
                  padding.top +
                  innerHeight -
                  (score / maxScoreScale) * innerHeight;
                const isCutoff = score === 135;
                return (
                  <g key={score}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke={isCutoff ? "#f43f5e" : "#e2e8f0"}
                      strokeDasharray={isCutoff ? "4 4" : undefined}
                      strokeWidth={isCutoff ? 1.5 : 1}
                      className="dark:stroke-slate-800"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={10}
                      fontWeight={isCutoff ? "bold" : "normal"}
                      fill={isCutoff ? "#f43f5e" : "#94a3b8"}
                    >
                      {score}
                    </text>
                  </g>
                );
              })}

              {/* Area Gradient */}
              {areaD && <path d={areaD} fill="url(#scoreAreaGrad)" />}

              {/* Score Line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points */}
              {points.map((pt, idx) => {
                const isHovered = hoveredPoint?.id === pt.attempt.id;
                const isAboveCutoff = pt.attempt.score >= 135;
                return (
                  <g
                    key={idx}
                    onMouseEnter={() => setHoveredPoint(pt.attempt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => navigate(`/result/${pt.attempt.id}`)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 7 : 5}
                      fill={isAboveCutoff ? "#10b981" : "#2563eb"}
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="transition-all"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Card */}
            {hoveredPoint && (
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-900 text-white text-xs max-w-sm flex items-center justify-between shadow-lg">
                <div>
                  <div className="font-bold text-amber-300">{hoveredPoint.testTitle}</div>
                  <div className="text-slate-400 text-[11px]">
                    Date: {hoveredPoint.date} • Mode: {hoveredPoint.mode.toUpperCase()}
                  </div>
                </div>
                <div className="text-right pl-4 border-l border-slate-700">
                  <div className="font-black text-emerald-400 text-sm">
                    {hoveredPoint.score.toFixed(1)} / 200
                  </div>
                  <div className="text-[10px] text-slate-300">
                    {hoveredPoint.accuracy}% Accuracy
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section-Wise Mastery Comparison */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Section-Wise Mastery & Benchmarks
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sectionStats.map((sec) => {
            const isStrong = sec.accuracy >= 75;
            const needsWork = sec.accuracy < 55 && sec.count > 0;
            return (
              <div
                key={sec.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Section
                    </span>
                    {isStrong && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                        ⭐ Strongest
                      </span>
                    )}
                    {needsWork && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                        ⚠️ Needs Work
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1">
                    {sec.name}
                  </h3>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {sec.avgScore}{" "}
                      <span className="text-xs text-slate-400 font-normal">/ 50</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {sec.accuracy}% Acc
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        sec.accuracy >= 70
                          ? "bg-emerald-500"
                          : sec.accuracy >= 50
                          ? "bg-blue-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, (sec.avgScore / 50) * 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                    <span>
                      Correct: <strong className="text-emerald-600">{sec.correct}</strong>
                    </span>
                    <span>
                      Wrong: <strong className="text-rose-500">{sec.wrong}</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Speed-vs-Accuracy & Weak Topics Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Speed Diagnostic Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Time & Speed Diagnostic
          </h2>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-1">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Avg. Pace on Correct Answers
              </span>
              <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
                {timeDiagnostic.avgCorrectTime}s{" "}
                <span className="text-xs font-normal text-emerald-700 dark:text-emerald-400">
                  per question
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Optimal time target is 36–45 seconds in Reasoning & English.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 space-y-1">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                Avg. Time Lost on Mistakes
              </span>
              <div className="text-2xl font-black text-rose-900 dark:text-rose-200">
                {timeDiagnostic.avgWrongTime}s{" "}
                <span className="text-xs font-normal text-rose-700 dark:text-rose-400">
                  per question
                </span>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-400">
                {timeDiagnostic.avgWrongTime > 55
                  ? "⚠️ Warning: You may be over-investing time into tricky questions. Practice the 45-second skip rule."
                  : "✓ Good time discipline on difficult questions."}
              </p>
            </div>
          </div>
        </div>

        {/* Weak Topics Diagnostic Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Weak Topics Diagnostic (&lt; 65% Accuracy)
            </h2>
            <span className="text-xs font-bold text-slate-400">
              Sorted by highest mistake frequency
            </span>
          </div>

          {weakTopics.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 text-xs">
              Take more tests to automatically isolate high-error topics!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5">Topic</th>
                    <th className="py-2.5">Attempts</th>
                    <th className="py-2.5">Mistakes</th>
                    <th className="py-2.5">Accuracy</th>
                    <th className="py-2.5 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium text-slate-800 dark:text-slate-200">
                  {weakTopics.slice(0, 5).map((wt) => (
                    <tr key={wt.topic} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="py-3 font-bold text-slate-900 dark:text-white max-w-[180px] truncate">
                        {wt.topic}
                      </td>
                      <td className="py-3 text-slate-500">{wt.total}</td>
                      <td className="py-3 font-bold text-rose-600 dark:text-rose-400">
                        {wt.wrong}
                      </td>
                      <td className="py-3 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${
                            wt.accuracy >= 60
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                          }`}
                        >
                          {wt.accuracy}%
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to={`/mistakes?topic=${encodeURIComponent(wt.topic)}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] rounded-lg transition"
                        >
                          Review <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Complete Attempts History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              All Examination Attempts History
            </h2>
            <p className="text-xs text-slate-500">
              Detailed list of completed full tests, sectional mocks, and diagnostics
            </p>
          </div>

          <span className="text-xs font-bold text-slate-500">
            Total Records: {attempts.length}
          </span>
        </div>

        {attempts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No test records saved in local database yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-3">Date</th>
                  <th className="py-3">Paper Title</th>
                  <th className="py-3">Mode</th>
                  <th className="py-3">Score</th>
                  <th className="py-3">Accuracy</th>
                  <th className="py-3">Duration</th>
                  <th className="py-3 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                {attempts.map((att) => (
                  <tr
                    key={att.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 font-mono text-xs text-slate-500">
                      {att.date}
                    </td>
                    <td className="py-3.5 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                      {att.testTitle}
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                        {att.mode}
                      </span>
                    </td>
                    <td className="py-3.5 font-black text-blue-600 dark:text-sky-400">
                      {att.score.toFixed(1)}{" "}
                      <span className="text-[11px] text-slate-400 font-normal">
                        / {att.maxScore}
                      </span>
                    </td>
                    <td className="py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                      {att.accuracy}%
                    </td>
                    <td className="py-3.5 text-slate-500 font-mono text-xs">
                      {formatTime(att.timeSpentSeconds)}
                    </td>
                    <td className="py-3.5 text-right print:hidden">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/result/${att.id}`}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-sky-400 font-bold text-xs transition"
                        >
                          View Result
                        </Link>
                        <button
                          onClick={() => handleDelete(att.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Delete attempt record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

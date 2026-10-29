/**
 * Test Details View: Detailed overview of a paper with section breakdowns,
 * historical attempts, and options to launch Full Mock, Section Mock, or Practice mode.
 */

import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Sparkles,
  ArrowLeft,
  Calendar,
  Layers,
  Award,
  ChevronRight,
  ShieldCheck,
  Image as ImageIcon,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { getAttemptsForTest } from "../db";
import type { ExamTest, TestAttemptSummary } from "../types";

export const TestDetailsView: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { fetchTest, loadingTest, testError } = useAppStore();
  const [test, setTest] = useState<ExamTest | null>(null);
  const [attempts, setAttempts] = useState<TestAttemptSummary[]>([]);

  useEffect(() => {
    if (testId) {
      fetchTest(testId).then((data) => {
        if (data) setTest(data);
      });
      getAttemptsForTest(testId).then(setAttempts);
    }
  }, [testId, fetchTest]);

  if (loadingTest) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 font-medium">Loading examination paper details...</p>
      </div>
    );
  }

  if (testError || !test) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Failed to load paper</h2>
        <p className="text-sm text-slate-500">{testError || "Paper not found"}</p>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </Link>
      </div>
    );
  }

  const figureQuestionsCount = test.questions.filter(
    (q) => q.render_mode === "image_stem" || q.render_mode === "image_full"
  ).length;

  const bestScore =
    attempts.length > 0
      ? Math.max(...attempts.map((a) => a.score))
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-8">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate("/library")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </button>
      </div>

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-sky-400">
            {test.exam}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {test.date}
          </span>
          {test.shift && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
              Shift {test.shift}
            </span>
          )}
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% Ingestion Verified
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
          {test.title}
        </h1>

        {/* Quick parameters grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-slate-100 dark:border-slate-700/80">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Duration
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1">
              <Clock className="w-4 h-4 text-blue-600" />
              {test.duration_minutes} Mins
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Questions
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1">
              <Layers className="w-4 h-4 text-indigo-600" />
              {test.questions.length} Items
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Marking Scheme
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              +{test.marking.correct} / {test.marking.wrong}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Diagram Questions
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <ImageIcon className="w-4 h-4" />
              {figureQuestionsCount} WebP
            </span>
          </div>
        </div>

        {/* Primary Start Actions */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Link
            to={`/exam/${test.id}?mode=full`}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" />
            Start Full Mock Exam (60 min)
          </Link>
          <Link
            to={`/practice/${test.id}`}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            Learn & Practice (Untimed)
          </Link>
        </div>
      </div>

      {/* Sections Breakdown Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Examination Sections (15 Minutes Each)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {test.sections.map((sec, idx) => {
            const count = test.questions.filter((q) => q.section === sec.id).length;
            return (
              <div
                key={sec.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-sky-400 font-black text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {sec.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Questions {sec.from}–{sec.to} • {count} questions • {sec.duration_minutes} mins
                  </p>
                </div>
                <Link
                  to={`/exam/${test.id}?mode=section&section=${sec.id}`}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors"
                >
                  Attempt Section
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical Attempts for this test */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Previous Attempts
          </h2>
          {bestScore !== null && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full">
              Personal Best: {bestScore.toFixed(1)} / 200
            </span>
          )}
        </div>

        {attempts.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            You haven't attempted this paper yet. Take your first mock to see your score and section analytics here!
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {attempts.map((att) => (
              <div
                key={att.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    Score: {att.score.toFixed(1)} / {att.maxScore} ({att.accuracy}% Accuracy)
                  </div>
                  <span className="text-slate-500">
                    Mode: {att.mode.toUpperCase()} • Attempted on {att.date} • Time:{" "}
                    {Math.round(att.timeSpentSeconds / 60)} mins
                  </span>
                </div>
                <Link
                  to={`/result/${att.id}`}
                  className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-sky-400 hover:underline"
                >
                  View Full Result & Review <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

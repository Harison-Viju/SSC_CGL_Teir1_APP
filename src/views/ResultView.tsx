/**
 * ResultView: Comprehensive post-exam result analysis, section breakdowns,
 * topic strengths/weaknesses, and complete question-by-question review.
 */

import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowLeft,
  RotateCcw,
  Share2,
  Filter,
  BarChart2,
  Award,
  ChevronRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAppStore } from "../store/useAppStore";
import { Mascot } from "../components/Mascot";
import { QuestionCard } from "../components/QuestionCard";
import { db } from "../db";
import { formatTime } from "../utils/examEngine";
import type { TestAttemptSummary, ExamTest, Question } from "../types";

export const ResultView: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { fetchTest, settings } = useAppStore();

  const [attempt, setAttempt] = useState<TestAttemptSummary | null>(null);
  const [test, setTest] = useState<ExamTest | null>(null);
  const [loading, setLoading] = useState(true);

  // Review mode filter: all, wrong, skipped, correct
  const [reviewFilter, setReviewFilter] = useState<"all" | "wrong" | "skipped" | "correct">("all");
  const [activeReviewQIndex, setActiveReviewQIndex] = useState(0);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    if (!attemptId) return;

    db.attempts.get(attemptId).then(async (att) => {
      if (att) {
        setAttempt(att);
        const testData = await fetchTest(att.testId);
        if (testData) setTest(testData);

        // Confetti if score is high and motion is enabled
        if (att.accuracy >= 65 && !settings.reducedMotion) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      }
      setLoading(false);
    });
  }, [attemptId, fetchTest, settings.reducedMotion]);

  if (loading || !attempt || !test) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 font-medium">Computing your detailed examination report...</p>
      </div>
    );
  }

  // Determine Mascot emotion
  const scorePercent = (attempt.score / (attempt.maxScore || 200)) * 100;
  let mascotState: "celebrate" | "proud" | "happy" | "thinking" = "happy";
  let mascotMessage = "Solid effort! Let's analyze your mistakes to boost your rank!";

  if (scorePercent >= 75) {
    mascotState = "celebrate";
    mascotMessage = `Superb job! ${attempt.score.toFixed(1)}/200 puts you in top-tier performance territory!`;
  } else if (scorePercent >= 50) {
    mascotState = "proud";
    mascotMessage = `Good score of ${attempt.score.toFixed(1)}! Reviewing wrong questions will help you cross 150+!`;
  } else {
    mascotState = "thinking";
    mascotMessage = "Every mock is a diagnostic! Use the Mistake Review below to master tricky questions.";
  }

  // Filtered review questions
  const reviewQuestions = test.questions.filter((q) => {
    const userAns = attempt.userAnswers[q.n];
    if (reviewFilter === "wrong") {
      return userAns !== undefined && userAns !== q.answer;
    }
    if (reviewFilter === "skipped") {
      return userAns === undefined;
    }
    if (reviewFilter === "correct") {
      return userAns === q.answer;
    }
    return true;
  });

  const currentReviewQ = reviewQuestions[activeReviewQIndex];
  const currentPassage = currentReviewQ?.passage_id
    ? test.passages.find((p) => p.id === currentReviewQ.passage_id)
    : null;

  const handleShare = () => {
    const text = `🎯 I scored ${attempt.score.toFixed(1)}/200 (${attempt.accuracy}% accuracy) on ${test.title} via ExamQuest!`;
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-8">
      {/* Top back button */}
      <div>
        <Link
          to={`/test/${test.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Paper Overview
        </Link>
      </div>

      {/* Main Score & Mascot Hero Banner */}
      <div className="bg-gradient-to-br from-indigo-700 via-blue-700 to-sky-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-amber-300">
              <Trophy className="w-3.5 h-3.5" /> Exam Scorecard
            </span>
            <h1 className="text-3xl sm:text-4xl font-black">{test.title}</h1>

            <div className="flex flex-wrap items-baseline gap-3 pt-1 justify-center md:justify-start">
              <span className="text-4xl sm:text-5xl font-black text-amber-300 tracking-tight">
                {attempt.score.toFixed(1)}
              </span>
              <span className="text-blue-200 font-bold text-lg">/ {attempt.maxScore} Marks</span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-300 font-bold text-xs">
                {attempt.accuracy}% Accuracy
              </span>
            </div>

            <p className="text-blue-100 text-xs sm:text-sm">
              Time Used: {Math.round(attempt.timeSpentSeconds / 60)} minutes • Date: {attempt.date}
            </p>
          </div>

          <div className="shrink-0">
            <Mascot state={mascotState} size="lg" message={mascotMessage} />
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Attempted
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {attempt.attempted} <span className="text-xs text-slate-400 font-normal">/ {attempt.totalQuestions}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
            Correct Answers
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" />
            {attempt.correct}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block">
            Wrong Answers
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <XCircle className="w-5 h-5" />
            {attempt.wrong}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Skipped
          </span>
          <div className="text-2xl font-black text-slate-600 dark:text-slate-300">
            {attempt.skipped}
          </div>
        </div>
      </div>

      {/* Section-Wise Performance Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-600 dark:text-sky-400" />
          Section-Wise Performance
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5">Section</th>
                <th className="py-2.5">Score</th>
                <th className="py-2.5">Correct</th>
                <th className="py-2.5">Wrong</th>
                <th className="py-2.5">Skipped</th>
                <th className="py-2.5">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium text-slate-800 dark:text-slate-200">
              {test.sections.map((sec) => {
                const sStats = attempt.sectionScores[sec.id] || {
                  score: 0,
                  maxScore: 50,
                  correct: 0,
                  wrong: 0,
                  skipped: 25,
                  timeSpentSeconds: 0,
                };
                return (
                  <tr key={sec.id}>
                    <td className="py-3 font-bold text-slate-900 dark:text-white">
                      {sec.name}
                    </td>
                    <td className="py-3 font-extrabold text-blue-600 dark:text-sky-400">
                      {sStats.score.toFixed(1)} / {sStats.maxScore}
                    </td>
                    <td className="py-3 text-emerald-600 font-bold">{sStats.correct}</td>
                    <td className="py-3 text-rose-600 font-bold">{sStats.wrong}</td>
                    <td className="py-3 text-slate-400">{sStats.skipped}</td>
                    <td className="py-3 text-slate-500 font-mono">
                      {formatTime(sStats.timeSpentSeconds)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons: Practice Mistakes, Retake, Share */}
      <div className="flex flex-wrap gap-3">
        <Link
          to={`/practice/${test.id}?onlyWrong=1`}
          className="flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Practice Wrong Questions ({attempt.wrong})
        </Link>
        <Link
          to={`/exam/${test.id}?mode=full`}
          className="flex items-center justify-center gap-2 py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Retake Test
        </Link>
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 py-3 px-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-xs hover:bg-slate-50 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          {copiedShare ? "Copied to Clipboard!" : "Share Result"}
        </button>
      </div>

      {/* Comprehensive Question Review Mode */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Question-by-Question Solution Review
          </h2>

          {/* Filter Pills */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
            {(
              [
                { id: "all", label: `All (${test.questions.length})` },
                { id: "wrong", label: `Wrong (${attempt.wrong})` },
                { id: "skipped", label: `Skipped (${attempt.skipped})` },
                { id: "correct", label: `Correct (${attempt.correct})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setReviewFilter(f.id);
                  setActiveReviewQIndex(0);
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  reviewFilter === f.id
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Review Question Carousel / Navigation */}
        {reviewQuestions.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-500 text-xs">
            No questions match the "{reviewFilter}" filter.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                Reviewing Item {activeReviewQIndex + 1} of {reviewQuestions.length}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={activeReviewQIndex === 0}
                  onClick={() => setActiveReviewQIndex((i) => i - 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-200 font-bold"
                >
                  Prev
                </button>
                <button
                  disabled={activeReviewQIndex === reviewQuestions.length - 1}
                  onClick={() => setActiveReviewQIndex((i) => i + 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-200 font-bold"
                >
                  Next
                </button>
              </div>
            </div>

            {currentReviewQ && (
              <QuestionCard
                question={currentReviewQ}
                passage={currentPassage}
                isReviewMode={true}
                userAnswer={attempt.userAnswers[currentReviewQ.n]}
                selectedOption={attempt.userAnswers[currentReviewQ.n]}
                testId={test.id}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * QuestionPalette: High-legibility SSC CGL Examination Palette.
 * - Header: Line 1 = section short name + 56px mascot avatar; Line 2 = progress bar with "X/25" at its right (no percentage).
 * - Legend + filters merged into ONE row of five chips in a 5-column grid:
 *   Coloured dot, bold count on top, tiny label below: All, Ans, Skipped, Marked, New.
 *   Clicking a chip filters the grid.
 * - Grid: 5 columns, 44px cells, 10px gap, 10px padding, centered in the panel.
 */

import React, { useState, useMemo } from "react";
import { Check, Bookmark, X, Sparkles } from "lucide-react";
import type { PaletteStatus, Question } from "../types";
import { getQuestionStatus } from "../utils/examEngine";
import { Mascot } from "./Mascot";

interface QuestionPaletteProps {
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<number, number>;
  markedForReview: Record<number, boolean>;
  visited: Record<number, boolean>;
  onSelectQuestion: (index: number) => void;
  sectionName?: string;
  className?: string;
  proctorTip?: string;
  onNextProctorTip?: () => void;
  onClose?: () => void;
}

export type PaletteFilterMode =
  | "all"
  | "answered"
  | "skipped"
  | "marked"
  | "new";

export const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  questions,
  currentQuestionIndex,
  answers,
  markedForReview,
  visited,
  onSelectQuestion,
  sectionName,
  className = "",
  proctorTip = "Stay calm and focused. One question at a time!",
  onNextProctorTip,
  onClose,
}) => {
  const [filterMode, setFilterMode] = useState<PaletteFilterMode>("all");
  const [showSpeechBubble, setShowSpeechBubble] = useState(false);

  // Derive concise section name
  const displaySection = useMemo(() => {
    if (!sectionName) return "Section";
    const lower = sectionName.toLowerCase();
    if (lower.includes("reasoning") || lower.includes("intelligence")) return "Reasoning";
    if (lower.includes("general awareness") || lower.includes("awareness")) return "Gen Awareness";
    if (lower.includes("quant") || lower.includes("aptitude")) return "Quant";
    if (lower.includes("english") || lower.includes("comprehension")) return "English";
    return sectionName.split(" ")[0];
  }, [sectionName]);

  // Compute status breakdown
  const counts = useMemo(() => {
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;
    let answeredMarked = 0;
    let notVisited = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const isCurrent = i === currentQuestionIndex;
      const hasAnswer = answers[q.n] !== undefined;
      const isMarked = Boolean(markedForReview[q.n]);
      const status = getQuestionStatus(q.n, answers, markedForReview, visited);

      if (status === "answered") answered++;
      else if (status === "answered_and_marked") answeredMarked++;
      else if (status === "marked_for_review") marked++;
      else if (isCurrent && !hasAnswer && !isMarked) {
        // While user is currently on the question, it only turns coral AFTER navigating away
        notVisited++;
      } else if (status === "not_answered") {
        notAnswered++;
      } else {
        notVisited++;
      }
    }

    return { answered, notAnswered, marked, answeredMarked, notVisited };
  }, [questions, currentQuestionIndex, answers, markedForReview, visited]);

  const totalCount = questions.length;
  const answeredTotal = counts.answered + counts.answeredMarked;
  const markedTotal = counts.marked + counts.answeredMarked;
  const progressPercent =
    totalCount > 0 ? Math.round((answeredTotal / totalCount) * 100) : 0;

  // Filter questions based on selected chip
  const filteredQuestions = useMemo(() => {
    return questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q, idx }) => {
        const isCurrent = idx === currentQuestionIndex;
        const status = getQuestionStatus(q.n, answers, markedForReview, visited);

        if (filterMode === "all") return true;
        if (filterMode === "answered") {
          return status === "answered" || status === "answered_and_marked";
        }
        if (filterMode === "skipped") {
          if (isCurrent && answers[q.n] === undefined && !markedForReview[q.n]) {
            return false;
          }
          return status === "not_answered";
        }
        if (filterMode === "marked") {
          return status === "marked_for_review" || status === "answered_and_marked";
        }
        if (filterMode === "new") {
          if (isCurrent && answers[q.n] === undefined && !markedForReview[q.n]) {
            return true;
          }
          return status === "not_visited";
        }
        return true;
      });
  }, [questions, currentQuestionIndex, answers, markedForReview, visited, filterMode]);

  return (
    <div
      className={`bg-white dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 flex flex-col gap-3 shadow-xl text-slate-800 dark:text-slate-100 ${className}`}
    >
      {/* Header: Line 1 = section short name + avatar; Line 2 = progress bar with "X/25" at its right (no %) */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
              {displaySection}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 56px Mascot Avatar in corner */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSpeechBubble(!showSpeechBubble);
                  if (!showSpeechBubble && onNextProctorTip) {
                    onNextProctorTip();
                  }
                }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center p-1 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/70 border border-sky-200 dark:border-sky-800/60 transition-all hover:scale-105 shadow-xs cursor-pointer"
                title="Click Quizzy for proctor guidance"
                aria-label="Quizzy Proctor guidance"
              >
                <Mascot state="calm" size="sm" showBubble={false} />
              </button>

              {/* Speech Bubble Popover */}
              {showSpeechBubble && (
                <div className="absolute right-0 top-16 z-50 w-64 p-3 bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 rounded-2xl shadow-2xl text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between font-bold text-sky-600 dark:text-sky-400 pb-1 mb-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Quizzy Tip
                    </span>
                    <button
                      onClick={() => setShowSpeechBubble(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="italic text-[11px] leading-relaxed mb-2">"{proctorTip}"</p>
                  <div className="flex justify-end">
                    <button
                      onClick={onNextProctorTip}
                      className="text-[10px] font-bold text-sky-500 hover:text-sky-400 underline cursor-pointer"
                    >
                      Next tip →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Optional close button for drawer / sheet mode */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                aria-label="Close question palette"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Line 2: Progress bar with "X/25" at right (no percentage) */}
        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-mono text-slate-700 dark:text-slate-300 font-bold text-xs tabular-nums shrink-0">
            {answeredTotal}/{totalCount}
          </span>
        </div>
      </div>

      {/* Merged Legend & Filters: ONE row of five chips in a 5-column grid */}
      <div className="grid grid-cols-5 gap-1.5 shrink-0 select-none">
        {/* Chip 1: All */}
        <button
          onClick={() => setFilterMode("all")}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
            filterMode === "all"
              ? "bg-sky-50 border-sky-400 dark:bg-sky-950/70 dark:border-sky-500 shadow-xs ring-1 ring-sky-400"
              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Show all questions"
        >
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 tabular-nums">
              {totalCount}
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            All
          </span>
        </button>

        {/* Chip 2: Ans */}
        <button
          onClick={() => setFilterMode("answered")}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
            filterMode === "answered"
              ? "bg-emerald-50 border-emerald-400 dark:bg-emerald-950/70 dark:border-emerald-500 shadow-xs ring-1 ring-emerald-400"
              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Filter answered questions"
        >
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
              {answeredTotal}
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Ans
          </span>
        </button>

        {/* Chip 3: Skipped */}
        <button
          onClick={() => setFilterMode("skipped")}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
            filterMode === "skipped"
              ? "bg-rose-50 border-rose-400 dark:bg-rose-950/70 dark:border-rose-500 shadow-xs ring-1 ring-rose-400"
              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Filter skipped/unanswered questions"
        >
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="font-bold text-xs text-rose-600 dark:text-rose-400 tabular-nums">
              {counts.notAnswered}
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Skipped
          </span>
        </button>

        {/* Chip 4: Marked */}
        <button
          onClick={() => setFilterMode("marked")}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
            filterMode === "marked"
              ? "bg-purple-50 border-purple-400 dark:bg-purple-950/70 dark:border-purple-500 shadow-xs ring-1 ring-purple-400"
              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Filter marked for review questions"
        >
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="font-bold text-xs text-purple-600 dark:text-purple-400 tabular-nums">
              {markedTotal}
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Marked
          </span>
        </button>

        {/* Chip 5: New */}
        <button
          onClick={() => setFilterMode("new")}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
            filterMode === "new"
              ? "bg-slate-200 border-slate-400 dark:bg-slate-700/80 dark:border-slate-500 shadow-xs ring-1 ring-slate-400"
              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Filter not yet visited questions"
        >
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300 tabular-nums">
              {counts.notVisited}
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            New
          </span>
        </button>
      </div>

      {/* Grid: 5 columns, 44px cells, 10px gap, 10px padding, centered in panel */}
      <div className="flex-1 min-h-0 overflow-y-auto p-[10px] select-none flex justify-center [scrollbar-gutter:stable]">
        <div
          className="grid grid-cols-5 gap-[10px] justify-items-center"
          style={{ gridTemplateColumns: "repeat(5, 44px)" }}
        >
          {filteredQuestions.map(({ q, idx }) => {
            const isCurrent = idx === currentQuestionIndex;
            const status = getQuestionStatus(q.n, answers, markedForReview, visited);
            const hasAnswer = answers[q.n] !== undefined;
            const isMarked = Boolean(markedForReview[q.n]);

            // Base cell geometry: exactly 44x44px touch target, rounded-xl
            let cellStyle =
              "w-[44px] h-[44px] rounded-xl relative flex items-center justify-center font-bold text-sm transition-all cursor-pointer ";

            // Current question: neutral surface, 2px sky ring, 3px offset, slight scale
            if (isCurrent) {
              cellStyle +=
                "ring-2 ring-sky-400 ring-offset-[3px] ring-offset-white dark:ring-offset-slate-900 scale-105 z-10 font-extrabold shadow-md ";

              if (hasAnswer) {
                // Answered while current: mint fill + check
                cellStyle += "bg-emerald-500 text-white ";
              } else if (isMarked) {
                // Marked while current: violet fill
                cellStyle += "bg-purple-600 text-white ";
              } else {
                // Not answered yet while on it: neutral surface (not coral!)
                cellStyle +=
                  "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 ";
              }
            } else {
              // SSC standard non-current palette colors
              switch (status) {
                case "answered":
                  cellStyle +=
                    "bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs ";
                  break;
                case "not_answered":
                  // User navigated away without answering -> coral
                  cellStyle +=
                    "bg-rose-500 hover:bg-rose-600 text-white shadow-xs ";
                  break;
                case "marked_for_review":
                  // Marked without answering -> violet fill
                  cellStyle +=
                    "bg-purple-600 hover:bg-purple-700 text-white shadow-xs ";
                  break;
                case "answered_and_marked":
                  // Answered AND marked -> violet fill with mint badge
                  cellStyle +=
                    "bg-purple-600 hover:bg-purple-700 text-white shadow-xs ";
                  break;
                case "not_visited":
                default:
                  // Neutral unvisited tile
                  cellStyle +=
                    "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-300 ";
                  break;
              }
            }

            return (
              <button
                key={q.n}
                onClick={() => {
                  onSelectQuestion(idx);
                  if (onClose) onClose();
                }}
                className={cellStyle}
                aria-label={`Question ${q.n}, status: ${status}${
                  isCurrent ? " (current question)" : ""
                }`}
                title={`Question ${q.n}`}
              >
                <span>{q.n}</span>

                {/* Answered: Check indicator icon */}
                {status === "answered" && !isCurrent && (
                  <Check className="w-2.5 h-2.5 text-white/90 absolute bottom-1 right-1" />
                )}

                {/* Marked for review: Violet corner flag icon */}
                {(status === "marked_for_review" ||
                  status === "answered_and_marked") && (
                  <div className="absolute top-0.5 right-0.5">
                    <Bookmark className="w-2.5 h-2.5 fill-white text-white drop-shadow-xs" />
                  </div>
                )}

                {/* Ans & Marked special indicator badge */}
                {status === "answered_and_marked" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 absolute bottom-1 left-1 ring-1 ring-white dark:ring-slate-900" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

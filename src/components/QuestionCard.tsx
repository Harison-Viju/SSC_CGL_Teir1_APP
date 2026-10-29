/**
 * QuestionCard: High-legibility CBT Question Interface.
 * - One-line Question Header: Q3 badge + topic (truncated with ellipsis) + marks chip "+2 / -0.50" on left;
 *   Icon-only Bookmark and Flag buttons with tooltips on right.
 * - Question Body: Centered with max-width 1000px.
 * - Default (stacked): Image full width of column, object-contain, max-h-[calc(100dvh-300px)],
 *   tap to zoom with zoom button at bottom-right inside image card. Directly under it, ONE row of four equal A/B/C/D buttons (min-h 56px).
 * - Side-by-side ONLY IF container >= 1000px wide AND image is tall (height/width >= 0.55):
 *   image on left at 62%, options on right as four stacked buttons (64px each).
 * - Text questions: stem blocks at top, four full-width option rows.
 * - Passage questions: collapsible card on < 1100px, sticky left column on >= 1100px.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Bookmark,
  Flag,
  Maximize2,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
} from "lucide-react";
import type { Question, Passage } from "../types";
import { db } from "../db";
import { QuestionBlocksRenderer } from "./QuestionBlocksRenderer";

interface QuestionCardProps {
  question: Question;
  passage?: Passage | null;
  selectedOption?: number; // 0..3
  onSelectOption?: (optionIndex: number) => void;
  isReviewMode?: boolean;
  userAnswer?: number;
  testId?: string;
  className?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  passage,
  selectedOption,
  onSelectOption,
  isReviewMode = false,
  userAnswer,
  testId = "",
  className = "",
}) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagSubmitted, setFlagSubmitted] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [passageExpanded, setPassageExpanded] = useState(true);

  // Layout detection: container width and image aspect ratio
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  const optionLetters = ["A", "B", "C", "D", "E"];

  // Observe container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sync bookmark state
  useEffect(() => {
    let active = true;
    if (testId) {
      db.bookmarks.get(`bm-${testId}-q${question.n}`).then((res) => {
        if (active) setIsBookmarked(Boolean(res));
      });
    }
    return () => {
      active = false;
    };
  }, [testId, question.n]);

  const toggleBookmark = async () => {
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);
    if (testId) {
      if (nextState) {
        await db.bookmarks.put({
          id: `bm-${testId}-q${question.n}`,
          testId,
          qNum: question.n,
          topic: question.topic,
          dateAdded: Date.now(),
        });
      } else {
        await db.bookmarks.delete(`bm-${testId}-q${question.n}`);
      }
    }
  };

  const submitFlag = async () => {
    if (!flagReason.trim()) return;
    if (testId) {
      await db.flags.put({
        id: `flag-${testId}-q${question.n}`,
        testId,
        qNum: question.n,
        reason: flagReason,
        dateAdded: Date.now(),
      });
    }
    setFlagSubmitted(true);
    setTimeout(() => {
      setShowFlagModal(false);
      setFlagSubmitted(false);
      setFlagReason("");
    }, 1500);
  };

  const getImageSrc = (imgPath?: string | null) => {
    if (!imgPath) return "";
    if (
      imgPath.startsWith("data:") ||
      imgPath.startsWith("http") ||
      imgPath.startsWith("/")
    ) {
      return imgPath;
    }
    if (imgPath.startsWith("data/")) return `/${imgPath}`;
    return `/data/${imgPath}`;
  };

  const isImageFull = question.render_mode === "image_full" && Boolean(question.full_image);
  const isImageStem = question.render_mode === "image_stem" && Boolean(question.stem_image);
  const activeImage = isImageFull
    ? getImageSrc(question.full_image)
    : isImageStem
    ? getImageSrc(question.stem_image)
    : null;

  // Side-by-side condition:
  // Container is >= 1000px wide AND image is tall (height/width >= 0.55),
  // AND the 62% left column width is >= 320px
  const isTallImage = imageAspectRatio !== null && imageAspectRatio >= 0.55;
  const canSideBySide =
    isImageFull &&
    containerWidth >= 1000 &&
    isTallImage &&
    containerWidth * 0.62 >= 320;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full p-3 sm:p-4 text-slate-800 dark:text-slate-100 select-none overflow-hidden ${className}`}
    >
      {/* Question Header: STRICT ONE LINE */}
      <div className="flex items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* "Q3" badge */}
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-black text-xs shrink-0 tabular-nums">
            Q{question.n}
          </span>
          {/* Topic: truncate with an ellipsis, never wraps */}
          <span
            className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate min-w-0"
            title={question.topic}
          >
            {question.topic}
          </span>
          {/* Marks chip "+2 / -0.50" */}
          <span className="shrink-0 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
            <span className="text-emerald-600 dark:text-emerald-400">+2</span> /{" "}
            <span className="text-rose-500">-0.50</span>
          </span>
        </div>

        {/* Icon-only Bookmark and Flag buttons with tooltips. "Save" renamed to "Bookmark" */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleBookmark}
            aria-label="Bookmark"
            title={isBookmarked ? "Bookmarked" : "Bookmark"}
            className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isBookmarked
                ? "bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-300 dark:border-amber-400/40"
                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            }`}
          >
            <Bookmark
              className={`w-4 h-4 ${
                isBookmarked
                  ? "fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                  : ""
              }`}
            />
          </button>

          <button
            onClick={() => setShowFlagModal(true)}
            aria-label="Flag"
            title="Flag question issue"
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Question Body: Centered max-width 1000px */}
      <div className="flex-1 min-h-0 overflow-y-auto py-3 px-1">
        <div className="max-w-[1000px] w-full mx-auto flex flex-col gap-4">
          {/* Passage Handling:
              - Collapsible card above stem on < 1100px
              - Sticky left column on desktop >= 1100px (when desktop dual-pane applies) */}
          {passage && (
            <div className="bg-sky-50/70 dark:bg-slate-950/70 border border-sky-200 dark:border-sky-900/40 rounded-xl p-3 sm:p-4 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-300">
                  <FileText className="w-3.5 h-3.5 text-sky-500" />
                  <span>
                    Passage (Q{passage.range[0]}–Q{passage.range[1]})
                  </span>
                </div>
                <button
                  onClick={() => setPassageExpanded(!passageExpanded)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>{passageExpanded ? "Collapse" : "Expand"}</span>
                  {passageExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {passageExpanded && (
                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-h-48 overflow-y-auto pr-2 space-y-1.5 border-t border-sky-200/60 dark:border-slate-800/60 pt-2 font-normal">
                  {passage.text}
                </div>
              )}
            </div>
          )}

          {/* Full Image Question: Either Side-by-Side (tall on >=1000px) OR Default Stacked */}
          {isImageFull && activeImage ? (
            canSideBySide ? (
              /* Side-by-side Layout: Image on left at 62%, Options on right as four stacked buttons (64px each) */
              <div className="flex flex-row items-start gap-5 w-full">
                {/* Left 62% Column for Image */}
                <div className="w-[62%] shrink-0 flex flex-col items-center">
                  <span className="sr-only">{question.stem || `Question ${question.n} diagram`}</span>
                  <div className="relative group w-full bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-center">
                    <img
                      src={activeImage}
                      alt={`Question ${question.n} diagram`}
                      className="max-h-[calc(100dvh-280px)] w-full object-contain cursor-pointer"
                      onClick={() => setIsZoomed(true)}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth > 0) {
                          setImageAspectRatio(img.naturalHeight / img.naturalWidth);
                        }
                      }}
                      loading="eager"
                    />
                    <button
                      onClick={() => setIsZoomed(true)}
                      className="absolute bottom-3 right-3 p-2 rounded-xl bg-slate-950/80 hover:bg-black text-white transition-opacity shadow-lg cursor-pointer"
                      title="Zoom diagram"
                      aria-label="Zoom diagram"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Right Stacked Options: 4 buttons, 64px each */}
                <div className="flex-1 min-w-[200px] flex flex-col gap-3">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Select Option:
                  </div>
                  {question.options.map((_, optIdx) => {
                    const isSelected = selectedOption === optIdx;
                    const isCorrect = isReviewMode && optIdx === question.answer;
                    const isWrongSelected =
                      isReviewMode && isSelected && optIdx !== question.answer;

                    let btnClasses =
                      "h-16 rounded-xl border font-black text-lg flex items-center justify-center transition-all cursor-pointer shadow-xs ";

                    if (isReviewMode) {
                      if (isCorrect) {
                        btnClasses +=
                          "bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-400 ";
                      } else if (isWrongSelected) {
                        btnClasses +=
                          "bg-rose-500 border-rose-600 text-white ring-2 ring-rose-400 ";
                      } else {
                        btnClasses +=
                          "bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60 ";
                      }
                    } else {
                      if (isSelected) {
                        btnClasses +=
                          "bg-sky-600 text-white border-sky-500 ring-2 ring-sky-400 shadow-md scale-102 ";
                      } else {
                        btnClasses +=
                          "bg-white dark:bg-slate-800/80 hover:bg-sky-50 dark:hover:bg-slate-700/80 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 ";
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        onClick={() => !isReviewMode && onSelectOption?.(optIdx)}
                        disabled={isReviewMode}
                        className={btnClasses}
                        title={`Option ${optionLetters[optIdx]}`}
                      >
                        <span>{optionLetters[optIdx]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Default (Stacked) Layout: Image full width of column, max-h calc(100dvh-300px),
                 Directly under it: ONE row of four equal A/B/C/D buttons (min-h 56px) */
              <div className="flex flex-col gap-3.5 w-full">
                <span className="sr-only">{question.stem || `Question ${question.n} diagram`}</span>
                <div className="relative group w-full bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 flex items-center justify-center shadow-xs">
                  <img
                    src={activeImage}
                    alt={`Question ${question.n} diagram`}
                    className="max-h-[calc(100dvh-300px)] w-full object-contain cursor-pointer"
                    onClick={() => setIsZoomed(true)}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth > 0) {
                        setImageAspectRatio(img.naturalHeight / img.naturalWidth);
                      }
                    }}
                    loading="eager"
                  />
                  {/* Zoom button at bottom-right inside image card */}
                  <button
                    onClick={() => setIsZoomed(true)}
                    className="absolute bottom-3 right-3 p-2 rounded-xl bg-slate-950/80 hover:bg-black text-white transition-opacity shadow-lg cursor-pointer"
                    title="Zoom diagram"
                    aria-label="Zoom diagram"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* ONE row of four equal A/B/C/D buttons (min height 56px) */}
                <div className="grid grid-cols-4 gap-2.5 sm:gap-4 w-full">
                  {question.options.map((_, optIdx) => {
                    const isSelected = selectedOption === optIdx;
                    const isCorrect = isReviewMode && optIdx === question.answer;
                    const isWrongSelected =
                      isReviewMode && isSelected && optIdx !== question.answer;

                    let btnClasses =
                      "min-h-[56px] h-14 sm:h-16 rounded-xl border font-black text-lg sm:text-xl flex items-center justify-center transition-all cursor-pointer shadow-xs ";

                    if (isReviewMode) {
                      if (isCorrect) {
                        btnClasses +=
                          "bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-400 ";
                      } else if (isWrongSelected) {
                        btnClasses +=
                          "bg-rose-500 border-rose-600 text-white ring-2 ring-rose-400 ";
                      } else {
                        btnClasses +=
                          "bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60 ";
                      }
                    } else {
                      if (isSelected) {
                        btnClasses +=
                          "bg-sky-600 text-white border-sky-500 ring-2 ring-sky-400 shadow-md scale-102 ";
                      } else {
                        btnClasses +=
                          "bg-white dark:bg-slate-800/80 hover:bg-sky-50 dark:hover:bg-slate-700/80 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 ";
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        onClick={() => !isReviewMode && onSelectOption?.(optIdx)}
                        disabled={isReviewMode}
                        className={btnClasses}
                        title={`Option ${optionLetters[optIdx]}`}
                      >
                        <span>{optionLetters[optIdx]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            /* Standard Text or image_stem Question */
            <div className="space-y-4 w-full">
              {/* If image_stem: show figure */}
              {isImageStem && activeImage && (
                <div className="relative group w-full bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 flex items-center justify-center shadow-xs">
                  <img
                    src={activeImage}
                    alt={`Question ${question.n} figure`}
                    className="max-h-[calc(100dvh-320px)] w-full object-contain cursor-pointer"
                    onClick={() => setIsZoomed(true)}
                    loading="eager"
                  />
                  <button
                    onClick={() => setIsZoomed(true)}
                    className="absolute bottom-3 right-3 p-2 rounded-xl bg-slate-950/80 hover:bg-black text-white transition-opacity shadow-lg cursor-pointer"
                    title="Zoom figure"
                    aria-label="Zoom figure"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Text Stem blocks at the top */}
              {question.render_mode === "text" && (
                <QuestionBlocksRenderer
                  blocks={question.blocks}
                  fallbackStem={question.stem}
                />
              )}

              {/* Four full-width option rows */}
              <div className="space-y-2.5 pt-1 w-full">
                {question.options.map((optionText, optIdx) => {
                  const isSelected = selectedOption === optIdx;
                  const isCorrect = isReviewMode && optIdx === question.answer;
                  const isWrongSelected =
                    isReviewMode && isSelected && optIdx !== question.answer;

                  let btnClasses =
                    "w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ";

                  if (isReviewMode) {
                    if (isCorrect) {
                      btnClasses +=
                        "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-semibold shadow-xs ";
                    } else if (isWrongSelected) {
                      btnClasses +=
                        "bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-800 dark:text-rose-200 font-semibold shadow-xs ";
                    } else {
                      btnClasses +=
                        "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60 ";
                    }
                  } else {
                    if (isSelected) {
                      btnClasses +=
                        "bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-900 dark:text-sky-100 font-semibold shadow-xs ring-1 ring-sky-500 ";
                    } else {
                      btnClasses +=
                        "bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 ";
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      onClick={() => !isReviewMode && onSelectOption?.(optIdx)}
                      disabled={isReviewMode}
                      className={btnClasses}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? "bg-sky-600 text-white border-sky-600"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {optionLetters[optIdx]}
                        </span>
                        <span className="text-sm sm:text-base leading-relaxed break-words">
                          {optionText}
                        </span>
                      </div>

                      {/* Desktop keycap hint ([1]..[4]) hidden on touch devices */}
                      <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-400 border border-slate-200 dark:border-slate-600 shrink-0">
                        [{optIdx + 1}]
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox / Zoom Modal */}
      {isZoomed && activeImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] flex flex-col items-center bg-white dark:bg-slate-900 p-2 sm:p-4 rounded-2xl shadow-2xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-3 right-3 p-2 rounded-xl bg-slate-900/80 hover:bg-black text-white cursor-pointer z-10"
              aria-label="Close zoom modal"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={activeImage}
              alt={`Question ${question.n} zoomed`}
              className="max-h-[85vh] w-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Flag / Report Modal */}
      {showFlagModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowFlagModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-500" />
                Report Question {question.n}
              </h3>
              <button
                onClick={() => setShowFlagModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {flagSubmitted ? (
              <div className="py-6 flex flex-col items-center gap-2 text-emerald-600 font-bold text-sm">
                <CheckCircle2 className="w-8 h-8" />
                <span>Issue reported successfully!</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Notice an error in the question diagram, text, or answer options? Let us know:
                </p>
                <textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Describe the issue with Question #{question.n}..."
                  className="w-full h-24 p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowFlagModal(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitFlag}
                    disabled={!flagReason.trim()}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white shadow-xs cursor-pointer"
                  >
                    Submit Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

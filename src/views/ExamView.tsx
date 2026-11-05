/**
 * ExamView: High-Performance CBT Examination Engine.
 * Implements strict 100dvh layout: Header (56px) + Body + Bottom Action Bar (72px).
 * - Zero nested scrolling: Question + options visible together at 1366x768
 * - Section tabs: Short names with active section timer, full-name tooltips, lock icons
 * - Header collapses tabs into dropdown below 1100px with no horizontal overflow
 * - Mascot shrunk to 56px avatar in the corner of the palette panel (Proctor card & Breathe removed)
 * - Light and Dark theme support with instant toggle
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  AlertTriangle,
  Menu,
  Lock,
  Sun,
  Moon,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { QuestionCard } from "../components/QuestionCard";
import { QuestionPalette } from "../components/QuestionPalette";
import { formatTime, computeAttemptSummary } from "../utils/examEngine";
import {
  getInProgressAttempt,
  saveInProgressAttempt,
  clearInProgressAttempt,
  saveAttemptSummary,
  recordAnswer,
} from "../db";
import type { ExamTest, Question, InProgressAttempt } from "../types";

const SECTION_SHORT_NAMES: Record<string, string> = {
  reasoning: "Reasoning",
  general_awareness: "Gen Awareness",
  quantitative_aptitude: "Quant",
  english: "English",
  english_comprehension: "English",
};

export const ExamView: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = (searchParams.get("mode") as any) || "full";
  const selectedSectionParam = searchParams.get("section") || undefined;
  const isResume = searchParams.get("resume") === "1";

  const { fetchTest, settings, updateSettings, refreshInProgress } = useAppStore();

  const [test, setTest] = useState<ExamTest | null>(null);
  const [loading, setLoading] = useState(true);

  // Active exam state
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [visited, setVisited] = useState<Record<number, boolean>>({});
  const [timeSpentPerQuestion, setTimeSpentPerQuestion] = useState<Record<number, number>>({});

  // Timers: absolute endsAt
  const [endsAt, setEndsAt] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600);
  const [sectionEndsAt, setSectionEndsAt] = useState<number>(0);
  const [sectionRemainingSeconds, setSectionRemainingSeconds] = useState<number>(900);

  // Modals & Drawers
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [currentMascotTipIndex, setCurrentMascotTipIndex] = useState(0);

  // Section Alert
  const [sectionTimeAlert, setSectionTimeAlert] = useState<string | null>(null);

  // Timestamp references
  const questionStartRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<any>(null);

  // Calming Proctor Tips
  const proctorTips = [
    "Stay calm and breathe. One question at a time.",
    "45s Rule: If stuck on a calculation, mark for review and keep moving!",
    "Read the question stem carefully, especially words like 'NOT' or 'EXCEPT'.",
    "Eliminate 2 unlikely options first to double your odds.",
    "Pacing check: 25 questions in 15 mins gives ~36 seconds per question.",
    "Trust your preparation. Maintain a steady, calm rhythm.",
  ];

  // Filter questions for active section
  const activeQuestions = React.useMemo(() => {
    if (!test) return [];
    if (mode === "section" && selectedSectionParam) {
      return test.questions.filter((q) => q.section === selectedSectionParam);
    }
    const secDef = test.sections[activeSectionIndex];
    if (secDef && settings.strictSections) {
      return test.questions.filter((q) => q.section === secDef.id);
    }
    return test.questions;
  }, [test, mode, selectedSectionParam, activeSectionIndex, settings.strictSections]);

  const currentQuestion: Question | undefined = activeQuestions[currentQIndex];

  // Derive activeSection dynamically: always matches current question's section or selected section
  const activeSection = React.useMemo(() => {
    if (!test) return undefined;
    if (currentQuestion?.section) {
      const found = test.sections.find((s) => s.id === currentQuestion.section);
      if (found) return found;
    }
    if (mode === "section" && selectedSectionParam) {
      const found = test.sections.find((s) => s.id === selectedSectionParam);
      if (found) return found;
    }
    return test.sections[activeSectionIndex] || test.sections[0];
  }, [test, currentQuestion?.section, mode, selectedSectionParam, activeSectionIndex]);

  // Record time spent on current question
  const recordQuestionTime = useCallback(() => {
    if (!currentQuestion) return;
    const now = Date.now();
    const elapsed = Math.round((now - questionStartRef.current) / 1000);
    if (elapsed > 0) {
      setTimeSpentPerQuestion((prev) => ({
        ...prev,
        [currentQuestion.n]: (prev[currentQuestion.n] || 0) + elapsed,
      }));
    }
    questionStartRef.current = now;
  }, [currentQuestion]);

  // Submit test and persist results
  const handleSubmitTest = useCallback(async () => {
    if (!test) return;
    recordQuestionTime();

    const summary = computeAttemptSummary(
      test,
      mode,
      answers,
      timeSpentPerQuestion,
      Date.now() - (3600 - remainingSeconds) * 1000,
      Date.now()
    );

    await saveAttemptSummary(summary);

    // Record question history for topic mastery and sprint prioritization
    for (const q of test.questions) {
      if (!q.qkey) continue;
      const userAns = answers[q.n];
      const spentSec = timeSpentPerQuestion[q.n] || 0;
      let result: "correct" | "wrong" | "skipped" = "skipped";
      if (userAns !== undefined && userAns !== null) {
        result = userAns === q.answer ? "correct" : "wrong";
      }
      await recordAnswer({
        qkey: q.qkey,
        result,
        timeMs: spentSec * 1000,
      });
    }

    if (testId) {
      await clearInProgressAttempt(testId);
    }
    await refreshInProgress();
    navigate(`/result/${summary.id}`);
  }, [
    test,
    mode,
    answers,
    timeSpentPerQuestion,
    remainingSeconds,
    testId,
    navigate,
    recordQuestionTime,
    refreshInProgress,
  ]);

  // Load test data & restore/initialize state
  useEffect(() => {
    if (!testId) return;

    fetchTest(testId).then(async (data) => {
      if (!data) {
        setLoading(false);
        return;
      }
      setTest(data);

      const savedAttempt = isResume ? await getInProgressAttempt(testId) : undefined;
      const now = Date.now();

      if (savedAttempt && savedAttempt.remainingSeconds > 5) {
        setAnswers(savedAttempt.answers || {});
        setMarkedForReview(savedAttempt.markedForReview || {});
        setCurrentQIndex(savedAttempt.currentQuestionIndex || 0);
        setActiveSectionIndex(savedAttempt.currentSectionIndex || 0);
        setTimeSpentPerQuestion(savedAttempt.timeSpentPerQuestion || {});

        const newEndsAt = now + savedAttempt.remainingSeconds * 1000;
        setEndsAt(newEndsAt);
        setRemainingSeconds(savedAttempt.remainingSeconds);

        const secSecs =
          savedAttempt.sectionRemainingSeconds?.[
            data.sections[savedAttempt.currentSectionIndex]?.id
          ] || 900;
        setSectionEndsAt(now + secSecs * 1000);
        setSectionRemainingSeconds(secSecs);
      } else {
        const totalDurationSec = (data.duration_minutes || 60) * 60;
        const targetEndsAt = now + totalDurationSec * 1000;
        setEndsAt(targetEndsAt);
        setRemainingSeconds(totalDurationSec);

        const secSecs = 15 * 60;
        setSectionEndsAt(now + secSecs * 1000);
        setSectionRemainingSeconds(secSecs);

        if (mode === "section" && selectedSectionParam) {
          const sIdx = data.sections.findIndex((s) => s.id === selectedSectionParam);
          if (sIdx !== -1) {
            setActiveSectionIndex(sIdx);
          }
        }
      }

      setLoading(false);
      questionStartRef.current = Date.now();
    });
  }, [testId, isResume, mode, selectedSectionParam, fetchTest]);

  // Transition to next section and lock previous section
  const advanceToNextSection = useCallback(() => {
    if (!test) return;
    recordQuestionTime();

    if (activeSectionIndex < test.sections.length - 1) {
      const nextIndex = activeSectionIndex + 1;
      const nextSecName = test.sections[nextIndex]?.name || `Section ${nextIndex + 1}`;
      setActiveSectionIndex(nextIndex);
      setCurrentQIndex(0);
      const newSecEndsAt = Date.now() + 15 * 60 * 1000;
      setSectionEndsAt(newSecEndsAt);
      setSectionRemainingSeconds(15 * 60);

      setSectionTimeAlert(
        `Section time up. Starting ${nextSecName} (15 mins strictly).`
      );
      setTimeout(() => setSectionTimeAlert(null), 5000);
    } else {
      // Last section finished -> auto submit
      handleSubmitTest();
    }
  }, [test, activeSectionIndex, recordQuestionTime, handleSubmitTest]);

  // High-accuracy timer loop tracking absolute endsAt and sectionEndsAt
  useEffect(() => {
    if (loading || !endsAt) return;

    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const leftTotal = Math.max(0, Math.round((endsAt - now) / 1000));
      setRemainingSeconds(leftTotal);

      const leftSection = Math.max(0, Math.round((sectionEndsAt - now) / 1000));
      setSectionRemainingSeconds(leftSection);

      // Auto-submit on overall expiration
      if (leftTotal <= 0) {
        clearInterval(timerIntervalRef.current);
        handleSubmitTest();
      } else if (mode === "full" && settings.strictSections && leftSection <= 0) {
        advanceToNextSection();
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [
    loading,
    endsAt,
    sectionEndsAt,
    mode,
    settings.strictSections,
    handleSubmitTest,
    advanceToNextSection,
  ]);

  // Mark current question as visited
  useEffect(() => {
    if (currentQuestion) {
      setVisited((prev) => ({ ...prev, [currentQuestion.n]: true }));
    }
  }, [currentQuestion]);

  // Synchronize activeSectionIndex with current question's section
  useEffect(() => {
    if (!test || !currentQuestion) return;
    const targetSecIndex = test.sections.findIndex((s) => s.id === currentQuestion.section);
    if (targetSecIndex !== -1 && targetSecIndex !== activeSectionIndex) {
      setActiveSectionIndex(targetSecIndex);
    }
  }, [test, currentQuestion?.n, currentQuestion?.section, activeSectionIndex]);

  // Autosave to IndexedDB periodically
  useEffect(() => {
    if (!test || loading || remainingSeconds <= 0) return;

    const currentSecId = test.sections[activeSectionIndex]?.id || "reasoning";
    const attemptState: InProgressAttempt = {
      id: `inprog-${test.id}`,
      testId: test.id,
      mode,
      currentSectionIndex: activeSectionIndex,
      currentQuestionIndex: currentQIndex,
      answers,
      markedForReview,
      timeSpentPerQuestion,
      remainingSeconds,
      sectionRemainingSeconds: { [currentSecId]: sectionRemainingSeconds },
      startedAt: Date.now() - (3600 - remainingSeconds) * 1000,
      lastUpdated: Date.now(),
    };

    saveInProgressAttempt(attemptState);
  }, [
    test,
    loading,
    answers,
    markedForReview,
    activeSectionIndex,
    currentQIndex,
    remainingSeconds,
    sectionRemainingSeconds,
    timeSpentPerQuestion,
    mode,
  ]);

  // Navigation handlers
  const handleSelectOption = (optIdx: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.n]: optIdx }));
  };

  const handleClearResponse = () => {
    if (!currentQuestion) return;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestion.n];
      return copy;
    });
    setMarkedForReview((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestion.n];
      return copy;
    });
  };

  const handleToggleMark = () => {
    if (!currentQuestion) return;
    setMarkedForReview((prev) => ({
      ...prev,
      [currentQuestion.n]: !prev[currentQuestion.n],
    }));
  };

  const handleNext = () => {
    recordQuestionTime();
    if (currentQIndex < activeQuestions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    } else if (
      !settings.strictSections &&
      activeSectionIndex < (test?.sections?.length || 1) - 1
    ) {
      setActiveSectionIndex(activeSectionIndex + 1);
      setCurrentQIndex(0);
      setSectionEndsAt(Date.now() + 15 * 60 * 1000);
      setSectionRemainingSeconds(15 * 60);
    }
  };

  const handlePrevious = () => {
    recordQuestionTime();
    if (currentQIndex > 0) {
      setCurrentQIndex(currentQIndex - 1);
    }
  };

  const handleSelectQuestion = (index: number) => {
    recordQuestionTime();
    setCurrentQIndex(index);
    setMobilePaletteOpen(false);
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        showSubmitModal ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "1" || e.key.toLowerCase() === "a") handleSelectOption(0);
      else if (e.key === "2" || e.key.toLowerCase() === "b") handleSelectOption(1);
      else if (e.key === "3" || e.key.toLowerCase() === "c") handleSelectOption(2);
      else if (e.key === "4" || e.key.toLowerCase() === "d") handleSelectOption(3);
      else if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") handleNext();
      else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "p") handlePrevious();
      else if (e.key.toLowerCase() === "m") handleToggleMark();
      else if (e.key.toLowerCase() === "c") handleClearResponse();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const toggleTheme = () => {
    const next = settings.theme === "dark" ? "light" : "dark";
    updateSettings({ theme: next });
  };

  if (loading || !test || !currentQuestion) {
    return (
      <div className="h-screen w-screen bg-slate-50 dark:bg-[#060814] flex items-center justify-center p-4 text-slate-800 dark:text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-sky-600 dark:text-sky-300 text-xs sm:text-sm">
            Loading Examination Environment...
          </p>
        </div>
      </div>
    );
  }

  const currentPassage = currentQuestion.passage_id
    ? test.passages.find((p) => p.id === currentQuestion.passage_id)
    : null;

  const isTimerCritical = remainingSeconds <= 60;
  const isTimerLow = remainingSeconds <= 300;
  const isSectionCritical = sectionRemainingSeconds <= 60;

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col font-sans select-none bg-slate-100 dark:bg-[#060814] text-slate-800 dark:text-slate-100 relative">
      {/* HEADER:
          >= 1100px: One row (56px) - Logo | Section Tabs | Total Timer | Theme | Submit
          < 1100px: Two rows:
            Row 1: Logo | Total Timer | Palette Button | Theme | Submit
            Row 2: Four equal-width section tabs with active section timer
      */}
      <header className="shrink-0 z-30 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 shadow-xs">
        {/* Desktop Header (>= 1100px) */}
        <div className="hidden min-[1100px]:flex h-14 pl-4 pr-4 sm:pr-5 items-center justify-between gap-3">
          {/* Logo with 16px left padding (pl-4) so it's never clipped */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-black text-sm tracking-tight bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent">
              ExamQuest
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800/60 uppercase">
              CBT
            </span>
            <span className="hidden 2xl:inline text-xs font-medium text-slate-500 dark:text-slate-400 border-l border-slate-300 dark:border-slate-700 pl-2.5 truncate max-w-xs">
              {test.title}
            </span>
          </div>

          {/* Section Tabs (Reasoning, Gen Awareness, Quant, English) */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 min-w-0">
            {test.sections.map((sec, idx) => {
              const isActive = idx === activeSectionIndex;
              const isCompleted = idx < activeSectionIndex;
              const isUpcoming = idx > activeSectionIndex;
              const shortName =
                SECTION_SHORT_NAMES[sec.id] || sec.name.split(" ")[0];

              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    if (!settings.strictSections) {
                      recordQuestionTime();
                      setActiveSectionIndex(idx);
                      const targetQIdx = activeQuestions.findIndex((q) => q.section === sec.id);
                      if (targetQIdx !== -1) {
                        setCurrentQIndex(targetQIdx);
                      } else {
                        setCurrentQIndex(0);
                      }
                    }
                  }}
                  disabled={settings.strictSections && idx !== activeSectionIndex}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-sky-600 text-white shadow-xs"
                      : isCompleted
                      ? "bg-slate-200/60 dark:bg-slate-950/60 text-slate-400 dark:text-slate-500 cursor-not-allowed line-through"
                      : "bg-transparent text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  }`}
                  title={`${sec.name}${
                    isCompleted
                      ? " (Completed & Locked)"
                      : isUpcoming
                      ? " (Locked until current section ends)"
                      : " (Active Section)"
                  }`}
                >
                  {isCompleted && <Lock className="w-3 h-3 text-slate-400" />}
                  {isUpcoming && <Lock className="w-3 h-3 text-slate-400 dark:text-slate-600" />}
                  <span>{shortName}</span>
                  {isActive && (
                    <span className="font-mono text-[11px] font-bold opacity-90">
                      ({formatTime(sectionRemainingSeconds)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Controls: Total Timer, Theme Toggle, Submit */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Total Timer Chip */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono font-bold text-xs sm:text-sm tracking-wide transition-colors ${
                isTimerCritical
                  ? "bg-rose-600 text-white animate-pulse"
                  : isTimerLow
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-800"
              }`}
              title="Total exam time remaining"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(remainingSeconds)}</span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-800 hover:text-sky-500 transition-colors cursor-pointer"
              title={`Switch to ${settings.theme === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle theme"
            >
              {settings.theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Submit Button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
            >
              Submit
            </button>
          </div>
        </div>

        {/* Responsive Header (< 1100px): Two Rows */}
        <div className="min-[1100px]:hidden flex flex-col w-full">
          {/* Row 1: Logo | Total Timer | Palette Button | Submit */}
          <div className="h-12 pl-4 pr-3 flex items-center justify-between gap-1.5 w-full">
            {/* Logo with 16px left padding (pl-4) so it's never clipped */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-black text-sm tracking-tight bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent">
                ExamQuest
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold px-1 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800/60 uppercase">
                CBT
              </span>
            </div>

            {/* Controls Row: Timer Chip (ALWAYS visible) + Palette Button + Submit */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Total Timer Chip: ALWAYS VISIBLE */}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-mono font-bold text-xs tracking-wide shrink-0 ${
                  isTimerCritical
                    ? "bg-rose-600 text-white animate-pulse"
                    : isTimerLow
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-800"
                }`}
                title="Total exam time remaining"
              >
                <Clock className="w-3 h-3" />
                <span>{formatTime(remainingSeconds)}</span>
              </div>

              {/* Palette Button: "Palette 1/25" */}
              <button
                onClick={() => setMobilePaletteOpen(true)}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold text-xs shrink-0 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/80 transition-colors"
                aria-label="Open question palette"
              >
                <Menu className="w-3.5 h-3.5" />
                <span className="hidden sm:inline whitespace-nowrap">
                  Palette {currentQIndex + 1}/{activeQuestions.length}
                </span>
                <span className="sm:hidden whitespace-nowrap">
                  {currentQIndex + 1}/{activeQuestions.length}
                </span>
              </button>

              {/* Theme Toggle on Tablet */}
              <button
                onClick={toggleTheme}
                className="hidden md:flex p-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-800 hover:text-sky-500 transition-colors cursor-pointer shrink-0"
                aria-label="Toggle theme"
              >
                {settings.theme === "dark" ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Submit Button: Fully visible */}
              <button
                onClick={() => setShowSubmitModal(true)}
                className="px-2.5 sm:px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
              >
                Submit
              </button>
            </div>
          </div>

          {/* Row 2: Four equal-width section tabs with the active section's timer */}
          <div className="grid grid-cols-4 gap-1 px-2 sm:px-3 py-1 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800/80">
            {test.sections.map((sec, idx) => {
              const isActive = idx === activeSectionIndex;
              const isCompleted = idx < activeSectionIndex;
              const isUpcoming = idx > activeSectionIndex;
              const shortName =
                SECTION_SHORT_NAMES[sec.id] || sec.name.split(" ")[0];

              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    if (!settings.strictSections) {
                      recordQuestionTime();
                      setActiveSectionIndex(idx);
                      const targetQIdx = activeQuestions.findIndex((q) => q.section === sec.id);
                      if (targetQIdx !== -1) {
                        setCurrentQIndex(targetQIdx);
                      } else {
                        setCurrentQIndex(0);
                      }
                    }
                  }}
                  disabled={settings.strictSections && idx !== activeSectionIndex}
                  className={`w-full py-1 px-1 rounded-lg text-[11px] font-bold text-center truncate transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    isActive
                      ? "bg-sky-600 text-white shadow-xs"
                      : isCompleted
                      ? "bg-slate-200/50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 cursor-not-allowed line-through"
                      : "bg-white/60 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-800"
                  }`}
                  title={`${sec.name}${isActive ? ` (${formatTime(sectionRemainingSeconds)})` : ""}`}
                >
                  {isCompleted && <Lock className="w-2.5 h-2.5 shrink-0" />}
                  {isUpcoming && <Lock className="w-2.5 h-2.5 shrink-0 opacity-50" />}
                  <span className="truncate">{shortName}</span>
                  {isActive && (
                    <span className="font-mono text-[10px] tabular-nums shrink-0">
                      ({formatTime(sectionRemainingSeconds)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Section Transition Toast */}
      {sectionTimeAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-blue-600 text-white px-4 py-2 rounded-xl shadow-xl flex items-center gap-2.5 animate-bounce text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
          <span>{sectionTimeAlert}</span>
        </div>
      )}

      {/* MAIN WORKSPACE:
          >= 1100px: Two Columns (Question panel flex-1 min-w-0 + Palette panel 360px fixed)
          < 1100px: ONE Column (Question panel full width, palette is a drawer)
      */}
      <main className="flex-1 min-h-0 z-10 w-full px-2 sm:px-4 py-2 flex flex-row gap-3 overflow-hidden">
        {/* Question Panel: Centered and responsive */}
        <section className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden">
          {/* Question Content Area */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <QuestionCard
              question={currentQuestion}
              passage={currentPassage}
              selectedOption={answers[currentQuestion.n]}
              onSelectOption={handleSelectOption}
              testId={test.id}
              className="flex-1 min-h-0"
            />
          </div>

          {/* BOTTOM ACTION BAR (72px fixed height, never wrapping)
              Prev | Clear | Mark Review | Save & Next
              On phones (< sm), Clear becomes an icon button
          */}
          <footer className="h-[72px] shrink-0 bg-slate-50/95 dark:bg-slate-950/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Prev Button */}
              <button
                onClick={handlePrevious}
                disabled={currentQIndex === 0}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden xs:inline">Prev</span>
              </button>

              {/* Clear Button: text on desktop/tablet, icon on phones */}
              <button
                onClick={handleClearResponse}
                className="px-2.5 sm:px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                title="Clear response"
                aria-label="Clear response"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Mark for Review Button */}
              <button
                onClick={handleToggleMark}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl font-semibold text-xs transition-colors border cursor-pointer whitespace-nowrap ${
                  markedForReview[currentQuestion.n]
                    ? "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/80 dark:border-purple-400 dark:text-purple-200"
                    : "bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-300"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">
                  {markedForReview[currentQuestion.n] ? "Marked" : "Mark Review"}
                </span>
                <span className="xs:hidden">
                  {markedForReview[currentQuestion.n] ? "Marked" : "Mark"}
                </span>
              </button>

              {/* Save & Next Button */}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <span>Save & Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </footer>
        </section>

        {/* Desktop Palette Panel (>= 1100px): Fixed 360px Sidebar */}
        <aside className="hidden min-[1100px]:flex w-[360px] shrink-0 flex-col h-full overflow-hidden">
          <QuestionPalette
            questions={activeQuestions}
            currentQuestionIndex={currentQIndex}
            answers={answers}
            markedForReview={markedForReview}
            visited={visited}
            onSelectQuestion={handleSelectQuestion}
            sectionName={activeSection?.name}
            className="h-full flex-1 min-h-0 overflow-hidden"
            proctorTip={proctorTips[currentMascotTipIndex]}
            onNextProctorTip={() =>
              setCurrentMascotTipIndex(
                (prev) => (prev + 1) % proctorTips.length
              )
            }
          />
        </aside>
      </main>

      {/* Palette Drawer (< 1100px):
          - Right slide-in drawer on tablet (>= 768px)
          - Bottom sheet on phones (< 768px)
      */}
      {mobilePaletteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex md:justify-end justify-center items-end md:items-stretch"
          onClick={() => setMobilePaletteOpen(false)}
        >
          {/* Drawer Container: slides in from right on md (>=768px), or rises as bottom sheet on mobile (<768px) */}
          <div
            className="w-full md:w-[360px] max-h-[85vh] md:max-h-full h-auto md:h-full bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 rounded-t-3xl md:rounded-none p-3.5 flex flex-col shadow-2xl text-slate-100 animate-in fade-in slide-in-from-bottom md:slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 min-h-0 flex flex-col">
              <QuestionPalette
                questions={activeQuestions}
                currentQuestionIndex={currentQIndex}
                answers={answers}
                markedForReview={markedForReview}
                visited={visited}
                onSelectQuestion={handleSelectQuestion}
                sectionName={activeSection?.name}
                className="h-full flex-1 min-h-0 overflow-hidden"
                proctorTip={proctorTips[currentMascotTipIndex]}
                onNextProctorTip={() =>
                  setCurrentMascotTipIndex(
                    (prev) => (prev + 1) % proctorTips.length
                  )
                }
                onClose={() => setMobilePaletteOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-600/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Confirm Exam Submission
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you ready to finalize your test attempt?
                </p>
              </div>
            </div>

            {/* Questions Summary Matrix */}
            <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-200 dark:border-slate-800 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 font-bold">
                Answered: {Object.keys(answers).length}
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 font-bold">
                Unanswered:{" "}
                {test.questions.length - Object.keys(answers).length}
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/40 text-purple-800 dark:text-purple-300 font-bold">
                Marked:{" "}
                {Object.values(markedForReview).filter(Boolean).length}
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/40 text-sky-800 dark:text-sky-300 font-bold">
                Time Left: {formatTime(remainingSeconds)}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Submitting now will record your attempt and open your comprehensive scorecard, accuracy insights, and mistake notebook.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTest}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * PracticeView: Interactive, bite-sized Duolingo-style practice mode with Quizzy mascot,
 * instant feedback, streak combos, audio chimes, and confetti.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { useAppStore } from "../store/useAppStore";
import { Mascot, type MascotState } from "../components/Mascot";
import {
  playCorrectSound,
  playWrongSound,
  playStreakSound,
  playFinishFanfare,
} from "../utils/soundEffects";
import { calculateQuestionXp, calculateLevel } from "../utils/gamification";
import { db, getAttemptsForTest, recordAnswer } from "../db";
import type { Question } from "../types";
import { QuestionBlocksRenderer } from "../components/QuestionBlocksRenderer";
import messages from "../content/messages.json";
import { fetchAllQuestions, getStatsMap } from "../utils/questionsLoader";
import { pickQuestions, slugify } from "../utils/topicStats";

export interface PracticeViewProps {
  isTopicLearnMode?: boolean;
}

export const PracticeView: React.FC<PracticeViewProps> = ({
  isTopicLearnMode: propIsTopicLearnMode,
}) => {
  const { testId, topicId } = useParams<{ testId?: string; topicId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isTopicLearnMode = propIsTopicLearnMode || !!topicId || searchParams.get("mode") === "learn";
  const targetTopic = topicId || searchParams.get("topic");
  const filterParam = (searchParams.get("filter") as any) || "all";
  const countParam = parseInt(searchParams.get("count") || "10", 10);

  const activeTest = useAppStore((state) => state.activeTest);
  const fetchTest = useAppStore((state) => state.fetchTest);
  const loadingTest = useAppStore((state) => state.loadingTest);
  const userStats = useAppStore((state) => state.userStats);
  const addPracticeStats = useAppStore((state) => state.addPracticeStats);
  const settings = useAppStore((state) => state.settings);

  // Practice session settings
  const [chunkSize, setChunkSize] = useState<number>(10);
  const [lessonIndex, setLessonIndex] = useState<number>(0);
  const [selectedSection, setSelectedSection] = useState<string>("all");

  // Topic mode questions
  const [topicQuestions, setTopicQuestions] = useState<Question[] | null>(null);
  const [loadingTopicQuestions, setLoadingTopicQuestions] = useState<boolean>(false);

  // Query param filters
  const filterWrongOnly = searchParams.get("onlyWrong") === "1";
  const [wrongQNums, setWrongQNums] = useState<Set<number> | null>(null);

  // Current session questions
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);

  // Gamification session metrics
  const [sessionStreak, setSessionStreak] = useState<number>(0);
  const [sessionMaxStreak, setSessionMaxStreak] = useState<number>(0);
  const [sessionXp, setSessionXp] = useState<number>(0);
  const [sessionCorrectCount, setSessionCorrectCount] = useState<number>(0);
  const [sessionAnsweredCount, setSessionAnsweredCount] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Mascot interaction
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [mascotMessage, setMascotMessage] = useState<string>(
    filterWrongOnly
      ? "Targeted Mistake Practice! Let's conquer each question you previously missed!"
      : "Welcome to Practice Mode! Pick your answer and learn step-by-step."
  );

  // Bookmarking & Flagging state
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [showFlagModal, setShowFlagModal] = useState<boolean>(false);
  const [flagReason, setFlagReason] = useState<string>("wrong_answer");
  const [flagComment, setFlagComment] = useState<string>("");

  // Load test data
  useEffect(() => {
    if (!isTopicLearnMode && testId) {
      fetchTest(testId);
    }
  }, [isTopicLearnMode, testId, fetchTest]);

  // Load topic practice questions via pickQuestions across all tests
  const loadTopicDeck = useCallback(() => {
    if (isTopicLearnMode && targetTopic) {
      setLoadingTopicQuestions(true);
      Promise.all([
        fetchAllQuestions(),
        getStatsMap(),
        db.bookmarks.toArray(),
        db.flags.toArray(),
      ])
        .then(([allQs, sMap, bList, fList]) => {
          const bSet = new Set<string>();
          for (const b of bList) {
            const matched = allQs.find(
              (q) => q.n === b.qNum && (!b.testId || (q as any).testId === b.testId)
            );
            if (matched?.qkey) bSet.add(matched.qkey);
          }
          const fSet = new Set<string>();
          for (const f of fList) {
            const matched = allQs.find(
              (q) => q.n === f.qNum && (!f.testId || (q as any).testId === f.testId)
            );
            if (matched?.qkey) fSet.add(matched.qkey);
          }

          const chosen = pickQuestions({
            questions: allQs,
            topicId: targetTopic,
            filter: filterParam,
            count: countParam === 0 ? 9999 : countParam,
            statsMap: sMap,
            bookmarkedKeys: bSet,
            flaggedKeys: fSet,
          });

          setTopicQuestions(chosen);
          setLoadingTopicQuestions(false);
        })
        .catch((err) => {
          console.error("Failed to load topic questions:", err);
          setLoadingTopicQuestions(false);
        });
    }
  }, [isTopicLearnMode, targetTopic, filterParam, countParam]);

  useEffect(() => {
    loadTopicDeck();
  }, [loadTopicDeck]);

  // Load mistakes from past attempts if onlyWrong=1 (test practice mode)
  useEffect(() => {
    if (!isTopicLearnMode && testId && filterWrongOnly && activeTest) {
      getAttemptsForTest(testId).then((attempts) => {
        if (attempts.length > 0) {
          const latest = attempts[0];
          const wrongSet = new Set<number>();
          activeTest.questions.forEach((q) => {
            const ans = latest.userAnswers[q.n];
            if (ans !== undefined && ans !== q.answer) {
              wrongSet.add(q.n);
            }
          });
          setWrongQNums(wrongSet);
        }
      });
    }
  }, [isTopicLearnMode, testId, filterWrongOnly, activeTest]);

  // Filter pool based on section, wrong items, or topic
  const questionPool = useMemo(() => {
    if (isTopicLearnMode) {
      return topicQuestions || [];
    }
    if (!activeTest) return [];
    let list = activeTest.questions;
    if (selectedSection !== "all") {
      list = list.filter((q) => q.section === selectedSection);
    }
    if (filterWrongOnly && wrongQNums && wrongQNums.size > 0) {
      list = list.filter((q) => wrongQNums.has(q.n));
    }
    if (targetTopic) {
      list = list.filter((q) =>
        q.topic.toLowerCase().includes(targetTopic.toLowerCase())
      );
    }
    return list;
  }, [isTopicLearnMode, topicQuestions, activeTest, selectedSection, filterWrongOnly, wrongQNums, targetTopic]);

  // Sliced questions for the current lesson chunk
  const lessonQuestions = useMemo(() => {
    if (isTopicLearnMode) {
      return topicQuestions || [];
    }
    if (chunkSize === 0) return questionPool; // all
    const start = lessonIndex * chunkSize;
    return questionPool.slice(start, start + chunkSize);
  }, [isTopicLearnMode, topicQuestions, questionPool, lessonIndex, chunkSize]);

  const currentQuestion: Question | undefined = lessonQuestions[currentIndex];

  // Total lessons in current pool
  const totalLessons = useMemo(() => {
    if (isTopicLearnMode) return 1;
    if (chunkSize === 0) return 1;
    return Math.max(1, Math.ceil(questionPool.length / chunkSize));
  }, [isTopicLearnMode, questionPool.length, chunkSize]);

  // Check bookmark status
  useEffect(() => {
    if (!currentQuestion) return;
    const effectiveTestId = (currentQuestion as any).testId || testId || "topic";
    db.bookmarks
      .where(["testId", "qNum"])
      .equals([effectiveTestId, currentQuestion.n])
      .first()
      .then((bm) => setIsBookmarked(!!bm))
      .catch(() => setIsBookmarked(false));
  }, [testId, currentQuestion]);

  // Pick random message helper
  const getRandomMessage = useCallback((category: keyof typeof messages) => {
    const arr = (messages as Record<string, string[]>)[category];
    if (!arr || arr.length === 0) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }, []);

  // Question timing ref for recording answer duration
  const questionStartRef = useRef<number>(Date.now());
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [currentIndex, currentQuestion]);

  // Handle option selection & instant check
  const handleSelectOption = useCallback(
    (index: number) => {
      if (isAnswered || !currentQuestion) return;

      setSelectedOption(index);
      setIsAnswered(true);

      const correct = index === currentQuestion.answer;
      setIsCorrect(correct);
      setSessionAnsweredCount((prev) => prev + 1);

      // Record answer history immediately for topic mastery and sprint prioritization
      const elapsedMs = Math.max(0, Date.now() - questionStartRef.current);
      if (currentQuestion.qkey) {
        recordAnswer({
          qkey: currentQuestion.qkey,
          result: correct ? "correct" : "wrong",
          timeMs: elapsedMs,
        });
      }

      if (correct) {
        const nextStreak = sessionStreak + 1;
        setSessionStreak(nextStreak);
        if (nextStreak > sessionMaxStreak) {
          setSessionMaxStreak(nextStreak);
        }
        setSessionCorrectCount((prev) => prev + 1);

        const earned = calculateQuestionXp(true, nextStreak);
        setSessionXp((prev) => prev + earned);

        // Sound effect
        if (nextStreak === 3 || nextStreak === 5 || nextStreak === 10) {
          playStreakSound();
        } else {
          playCorrectSound();
        }

        // Mascot response
        if (nextStreak >= 10) {
          setMascotState("celebrate");
          setMascotMessage(getRandomMessage("streak_10"));
        } else if (nextStreak >= 5) {
          setMascotState("proud");
          setMascotMessage(getRandomMessage("streak_5"));
        } else if (nextStreak >= 3) {
          setMascotState("happy");
          setMascotMessage(getRandomMessage("streak_3"));
        } else {
          setMascotState("happy");
          setMascotMessage(getRandomMessage("correct"));
        }
      } else {
        setSessionStreak(0);
        playWrongSound();
        setMascotState("thinking");
        setMascotMessage(getRandomMessage("wrong"));
      }
    },
    [
      isAnswered,
      currentQuestion,
      sessionStreak,
      sessionMaxStreak,
      getRandomMessage,
    ]
  );

  // Move to next question or complete lesson
  const handleNext = useCallback(async () => {
    if (currentIndex + 1 < lessonQuestions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setIsCorrect(false);
      setMascotState("idle");
    } else {
      // Completed lesson
      setIsCompleted(true);
      playFinishFanfare();

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // Fallback if canvas-confetti is not loaded
      }

      setMascotState("celebrate");
      setMascotMessage(
        sessionCorrectCount / (lessonQuestions.length || 1) >= 0.7
          ? getRandomMessage("test_finish_good")
          : getRandomMessage("test_finish_bad")
      );

      // Persist earned XP and stats
      if (sessionXp > 0 || sessionAnsweredCount > 0) {
        await addPracticeStats(
          sessionXp,
          sessionAnsweredCount,
          sessionCorrectCount
        );
      }
    }
  }, [
    currentIndex,
    lessonQuestions.length,
    sessionCorrectCount,
    sessionXp,
    sessionAnsweredCount,
    addPracticeStats,
    getRandomMessage,
  ]);

  // Toggle bookmark
  const toggleBookmark = async () => {
    if (!currentQuestion) return;
    const effectiveTestId = (currentQuestion as any).testId || testId || "topic";
    if (isBookmarked) {
      await db.bookmarks
        .where(["testId", "qNum"])
        .equals([effectiveTestId, currentQuestion.n])
        .delete();
      setIsBookmarked(false);
    } else {
      await db.bookmarks.put({
        id: `${effectiveTestId}_${currentQuestion.n}`,
        testId: effectiveTestId,
        qNum: currentQuestion.n,
        dateAdded: Date.now(),
        topic: currentQuestion.topic,
      });
      setIsBookmarked(true);
    }
  };

  // Submit flag
  const handleFlagSubmit = async () => {
    if (!currentQuestion) return;
    const effectiveTestId = (currentQuestion as any).testId || testId || "topic";
    await db.flags.put({
      id: `${effectiveTestId}_${currentQuestion.n}_${Date.now()}`,
      testId: effectiveTestId,
      qNum: currentQuestion.n,
      dateAdded: Date.now(),
      reason: flagReason,
      details: flagComment,
    });
    setShowFlagModal(false);
    setFlagComment("");
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showFlagModal || isCompleted) return;

      if (!isAnswered) {
        if (e.key === "1" || e.key.toLowerCase() === "a") {
          e.preventDefault();
          handleSelectOption(0);
        } else if (e.key === "2" || e.key.toLowerCase() === "b") {
          e.preventDefault();
          handleSelectOption(1);
        } else if (e.key === "3" || e.key.toLowerCase() === "c") {
          e.preventDefault();
          handleSelectOption(2);
        } else if (e.key === "4" || e.key.toLowerCase() === "d") {
          e.preventDefault();
          handleSelectOption(3);
        }
      } else {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnswered, isCompleted, showFlagModal, handleSelectOption, handleNext]);

  // Restart or next lesson
  const startNextLesson = () => {
    if (lessonIndex + 1 < totalLessons) {
      setLessonIndex((prev) => prev + 1);
    } else {
      setLessonIndex(0);
    }
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setIsCorrect(false);
    setIsCompleted(false);
    setSessionXp(0);
    setSessionCorrectCount(0);
    setSessionAnsweredCount(0);
    setMascotState("idle");
    setMascotMessage("New lesson ready! Let's maintain that momentum!");
  };

  const restartCurrentLesson = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setIsCorrect(false);
    setIsCompleted(false);
    setSessionXp(0);
    setSessionCorrectCount(0);
    setSessionAnsweredCount(0);
    setMascotState("idle");
  };

  if (
    isTopicLearnMode
      ? loadingTopicQuestions || topicQuestions === null
      : loadingTest || !activeTest
  ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <Mascot state="thinking" size="lg" message="Loading practice questions..." />
        <p className="mt-4 text-slate-500 font-medium animate-pulse">
          Preparing your practice deck...
        </p>
      </div>
    );
  }

  // Handle empty question deck in topic learn mode
  if (isTopicLearnMode && topicQuestions && topicQuestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center max-w-md mx-auto">
        <Mascot state="thinking" size="lg" message="No questions match this filter." />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-4">
          No Questions Available
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
          There are no questions matching "{filterParam}" for this topic.
        </p>
        <button
          onClick={() => navigate(targetTopic ? `/train/${targetTopic}` : "/train")}
          className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition"
        >
          Back to Topic
        </button>
      </div>
    );
  }

  // Active Passage if question is part of a reading comprehension set
  const activePassage =
    currentQuestion?.passage_id && activeTest
      ? activeTest.passages.find((p) => p.id === currentQuestion.passage_id)
      : null;

  const currentLevelInfo = calculateLevel(userStats.xp + sessionXp);
  const progressPercent = Math.round(
    ((currentIndex + (isAnswered ? 1 : 0)) / (lessonQuestions.length || 1)) * 100
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Close button */}
          <button
            onClick={() => {
              if (isTopicLearnMode && targetTopic) {
                navigate(`/train/${targetTopic}`);
              } else if (activeTest) {
                navigate(`/test/${activeTest.id}`);
              } else {
                navigate("/train");
              }
            }}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Exit Practice"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Duolingo Progress Bar */}
          <div className="flex-1 max-w-md">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-1 font-semibold">
              <span>
                Q {currentIndex + 1} of {lessonQuestions.length}
              </span>
              <span>
                {isTopicLearnMode ? "Learn Mode" : `Lesson ${lessonIndex + 1}/${totalLessons}`}
              </span>
            </div>
          </div>

          {/* Gamification Stats: Streak & XP */}
          <div className="flex items-center gap-3">
            {/* Streak Counter */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm transition ${
                sessionStreak > 0
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 animate-pulse"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
              title="Consecutive correct answers"
            >
              <span>🔥</span>
              <span>{sessionStreak}</span>
            </div>

            {/* XP Gained */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-sm">
              <span>⚡</span>
              <span>+{sessionXp} XP</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col justify-center">
        {!isCompleted ? (
          <div>
            {/* Mascot Speech Bubble & Avatar */}
            <div className="flex items-end gap-3 mb-4">
              <Mascot state={mascotState} size="sm" showBubble={false} />
              <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm p-3.5 shadow-sm max-w-md text-sm font-medium text-slate-800 dark:text-slate-100">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-1.5">
                  Quizzy:
                </span>
                {mascotMessage}
              </div>
            </div>

            {/* Reading Comprehension Passage */}
            {activePassage && (
              <div className="mb-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-300 mb-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Passage for Questions {activePassage.range[0]} – {activePassage.range[1]}</span>
                </div>
                <div className="whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto pr-2">
                  {activePassage.text}
                </div>
              </div>
            )}

            {/* Question Card */}
            {currentQuestion && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-8 shadow-sm">
                {/* Topic & Question Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg uppercase tracking-wider">
                      Q{currentQuestion.n}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {currentQuestion.topic || "General"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleBookmark}
                      className={`p-2 rounded-xl text-xs font-semibold transition ${
                        isBookmarked
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                      title={isBookmarked ? "Remove Bookmark" : "Bookmark Question"}
                    >
                      <svg className="w-5 h-5" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowFlagModal(true)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Report / Flag Question"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Question Stem */}
                <div className="mb-6">
                  {currentQuestion.render_mode === "image_full" && currentQuestion.full_image ? (
                    <div>
                      <span className="sr-only">{currentQuestion.stem || `Question ${currentQuestion.n} diagram and choices`}</span>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 inline-block max-w-full">
                        <img
                          src={currentQuestion.full_image.startsWith("data/") || currentQuestion.full_image.startsWith("/") ? currentQuestion.full_image : `data/${currentQuestion.full_image}`}
                          alt={`Question ${currentQuestion.n}`}
                          className="max-h-96 rounded-lg object-contain mx-auto"
                        />
                      </div>
                    </div>
                  ) : currentQuestion.render_mode === "image_stem" && currentQuestion.stem_image ? (
                    <div>
                      <span className="sr-only">{currentQuestion.stem || `Question ${currentQuestion.n} figure`}</span>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 inline-block max-w-full mb-4">
                        <img
                          src={currentQuestion.stem_image.startsWith("data/") || currentQuestion.stem_image.startsWith("/") ? currentQuestion.stem_image : `data/${currentQuestion.stem_image}`}
                          alt={`Question ${currentQuestion.n} figure`}
                          className="max-h-72 rounded-lg object-contain mx-auto"
                        />
                      </div>
                    </div>
                  ) : (
                    <QuestionBlocksRenderer
                      blocks={currentQuestion.blocks}
                      fallbackStem={currentQuestion.stem}
                    />
                  )}
                </div>

                {/* Option Choices */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {currentQuestion.options.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isSelected = selectedOption === idx;
                    const isTheCorrectAnswer = idx === currentQuestion.answer;

                    // Compute dynamic button styling based on answered state
                    let btnStyle =
                      "bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30";
                    let badgeStyle =
                      "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300";

                    if (isAnswered) {
                      if (isTheCorrectAnswer) {
                        btnStyle =
                          "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-2 border-emerald-500 shadow-md";
                        badgeStyle = "bg-emerald-500 text-white";
                      } else if (isSelected) {
                        btnStyle =
                          "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-2 border-rose-500";
                        badgeStyle = "bg-rose-500 text-white";
                      } else {
                        btnStyle =
                          "opacity-50 border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400";
                      }
                    }

                    return (
                      <motion.button
                        key={idx}
                        whileTap={!isAnswered ? { scale: 0.98 } : {}}
                        onClick={() => handleSelectOption(idx)}
                        disabled={isAnswered}
                        className={`w-full text-left p-4 rounded-2xl flex items-center gap-3.5 font-medium transition-all ${btnStyle}`}
                      >
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition ${badgeStyle}`}
                        >
                          {letter}
                        </span>
                        <span className="flex-1 text-sm md:text-base leading-snug">
                          {currentQuestion.render_mode === "image_full"
                            ? `Option (${letter.toLowerCase()})`
                            : opt || `Option (${letter.toLowerCase()})`}
                        </span>

                        {/* Status Icon */}
                        {isAnswered && isTheCorrectAnswer && (
                          <span className="text-emerald-600 dark:text-emerald-400 shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                        {isAnswered && isSelected && !isTheCorrectAnswer && (
                          <span className="text-rose-600 dark:text-rose-400 shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Lesson Completed Celebration Card */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto shadow-xl"
          >
            <Mascot state="celebrate" size="xl" showBubble={false} className="mx-auto mb-4" />

            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-2">
              Lesson Complete! 🎉
            </h2>
            <p className="text-slate-600 dark:text-slate-300 font-medium mb-6">
              {mascotMessage}
            </p>

            {/* Performance Stats Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                  Accuracy
                </span>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                  {Math.round(
                    (sessionCorrectCount / (lessonQuestions.length || 1)) * 100
                  )}
                  %
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">
                  Max Streak
                </span>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
                  🔥 {sessionMaxStreak}
                </p>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-3">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                  XP Earned
                </span>
                <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                  +{sessionXp}
                </p>
              </div>
            </div>

            {/* Level Progress */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 mb-6 text-left">
              <div className="flex justify-between items-center mb-1 text-sm font-bold">
                <span className="text-indigo-600 dark:text-indigo-400">
                  Level {currentLevelInfo.level}: {currentLevelInfo.title}
                </span>
                <span className="text-slate-500 text-xs">
                  {currentLevelInfo.currentXp} XP
                </span>
              </div>
              <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${currentLevelInfo.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {isTopicLearnMode ? (
                <>
                  <button
                    onClick={() => {
                      loadTopicDeck();
                      restartCurrentLesson();
                    }}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition active:scale-[0.98]"
                  >
                    Practice again
                  </button>
                  <button
                    onClick={() => navigate(targetTopic ? `/train/${targetTopic}` : "/train")}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition"
                  >
                    Back to topic
                  </button>
                </>
              ) : lessonIndex + 1 < totalLessons ? (
                <button
                  onClick={startNextLesson}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition active:scale-[0.98]"
                >
                  Start Next Lesson ({lessonIndex + 2}/{totalLessons})
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/test/${activeTest?.id || ""}`)}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition active:scale-[0.98]"
                >
                  Finish & Back to Test Details
                </button>
              )}

              {!isTopicLearnMode && (
                <button
                  onClick={restartCurrentLesson}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition"
                >
                  Practice This Lesson Again
                </button>
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* Bottom Sticky Action Banner (Duolingo Style) */}
      {!isCompleted && (
        <footer
          className={`sticky bottom-0 z-30 px-4 py-4 md:py-5 border-t transition-colors ${
            isAnswered
              ? isCorrect
                ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            {/* Feedback info */}
            <div className="flex items-center gap-3 min-w-0">
              {isAnswered ? (
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shrink-0 shadow-sm ${
                      isCorrect ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  >
                    {isCorrect ? "✓" : "✕"}
                  </div>
                  <div>
                    <h4
                      className={`font-black text-base md:text-lg ${
                        isCorrect
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-rose-800 dark:text-rose-300"
                      }`}
                    >
                      {isCorrect ? "Spot On! +10 XP" : "Correct Answer:"}
                    </h4>
                    {!isCorrect && currentQuestion && (
                      <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 truncate">
                        Option ({String.fromCharCode(65 + currentQuestion.answer)})
                        {currentQuestion.render_mode !== "image_full" &&
                          currentQuestion.options[currentQuestion.answer] &&
                          `: ${currentQuestion.options[currentQuestion.answer]}`}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-sm text-slate-500 font-medium hidden sm:inline">
                  Select an option or press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 font-mono text-xs">1-4</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 font-mono text-xs">A-D</kbd>
                </span>
              )}
            </div>

            {/* Action button */}
            <div className="shrink-0">
              {isAnswered ? (
                <button
                  onClick={handleNext}
                  className={`px-8 py-3.5 rounded-2xl font-black text-white shadow-lg transition active:scale-[0.98] ${
                    isCorrect
                      ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                      : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
                  }`}
                >
                  {currentIndex + 1 < lessonQuestions.length
                    ? "Continue (Enter)"
                    : "Finish Lesson"}
                </button>
              ) : (
                <button
                  disabled
                  className="px-8 py-3.5 bg-slate-200 dark:bg-slate-800 text-slate-400 font-bold rounded-2xl cursor-not-allowed"
                >
                  Choose an Answer
                </button>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Flag / Report Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
              Report Question #{currentQuestion?.n}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Help improve the question bank. Flags are saved to your local overrides and can be exported.
            </p>

            <div className="space-y-3 mb-4">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                Reason
              </label>
              <select
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              >
                <option value="wrong_answer">Wrong Answer Key</option>
                <option value="bad_image">Bad / Blurry Image</option>
                <option value="typo">Typo in Question or Options</option>
                <option value="outdated">Question Outdated</option>
                <option value="other">Other Issue</option>
              </select>

              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                Additional Comments
              </label>
              <textarea
                value={flagComment}
                onChange={(e) => setFlagComment(e.target.value)}
                placeholder="Explain what needs fixing..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowFlagModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagSubmit}
                className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

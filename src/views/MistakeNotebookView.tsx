/**
 * MistakeNotebookView: Interactive Mistake Notebook & Bookmark Manager.
 * Features inline re-attempt testing, mastery tracking, reflection notes,
 * topic filtering, and CSV/print export.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  BookmarkCheck,
  Bookmark,
  CheckCircle2,
  XCircle,
  Sparkles,
  RotateCcw,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  Check,
  Edit3,
  Trash2,
  Play,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getAllAttempts,
  getAllBookmarks,
  removeBookmark,
  updateBookmarkNote,
  getMasteredMistakes,
  saveMasteredMistake,
  getMistakeNotes,
  saveMistakeNote,
} from "../db";
import { useAppStore } from "../store/useAppStore";
import { Mascot } from "../components/Mascot";
import {
  exportMistakesToCsv,
  exportBookmarksToCsv,
  type MistakeExportItem,
  type BookmarkExportItem,
} from "../utils/exportData";
import { playCorrectSound, playWrongSound } from "../utils/soundEffects";
import type { Question, ExamTest, Bookmark as BookmarkType } from "../types";
import { QuestionBlocksRenderer } from "../components/QuestionBlocksRenderer";

interface MistakeItem {
  key: string;
  testId: string;
  testTitle: string;
  question: Question;
  userAnswer?: number;
  correctAnswer: number;
  section: string;
  topic: string;
  date: string;
}

export const MistakeNotebookView: React.FC<{ initialTab?: "mistakes" | "bookmarks" }> = ({
  initialTab = "mistakes",
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchTest, manifest, addPracticeStats } = useAppStore();

  const [activeTab, setActiveTab] = useState<"mistakes" | "bookmarks">(
    (searchParams.get("tab") as any) || initialTab
  );

  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<
    Record<string, { question: Question; testTitle: string }>
  >({});
  const [masteredMap, setMasteredMap] = useState<Record<string, boolean>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTestId, setSelectedTestId] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [masteryFilter, setMasteryFilter] = useState<"all" | "unmastered" | "mastered">(
    "unmastered"
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get("topic") || ""
  );

  // Re-attempt inline states: questionKey -> { selectedOpt: number | null, isSubmitted: boolean, isCorrect: boolean }
  const [reattempts, setReattempts] = useState<
    Record<
      string,
      { selectedOpt: number | null; isSubmitted: boolean; isCorrect: boolean }
    >
  >({});

  // Editing note keys
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [currentNoteText, setCurrentNoteText] = useState<string>("");

  // Load all mistakes, bookmarks, and local metadata
  const loadData = async () => {
    setLoading(true);
    const [attempts, bms, mastered, notes] = await Promise.all([
      getAllAttempts(),
      getAllBookmarks(),
      getMasteredMistakes(),
      getMistakeNotes(),
    ]);

    setBookmarks(bms);
    setMasteredMap(mastered);
    setNotesMap(notes);

    // Aggregate unique mistakes
    const uniqueMistakesMap = new Map<string, MistakeItem>();
    const testsCache: Record<string, ExamTest> = {};

    for (const att of attempts) {
      if (!testsCache[att.testId]) {
        const t = await fetchTest(att.testId);
        if (t) testsCache[att.testId] = t;
      }
      const test = testsCache[att.testId];
      if (!test) continue;

      test.questions.forEach((q) => {
        const userChoice = att.userAnswers[q.n];
        // If wrong answer or skipped
        if (userChoice !== undefined && userChoice !== q.answer) {
          const key = `${att.testId}_${q.n}`;
          if (!uniqueMistakesMap.has(key)) {
            uniqueMistakesMap.set(key, {
              key,
              testId: att.testId,
              testTitle: test.title,
              question: q,
              userAnswer: userChoice,
              correctAnswer: q.answer,
              section: q.section,
              topic: q.topic || "General",
              date: att.date,
            });
          }
        }
      });
    }

    setMistakes(Array.from(uniqueMistakesMap.values()));

    // Load full question details for bookmarks
    const bmQuestionsMap: Record<
      string,
      { question: Question; testTitle: string }
    > = {};
    for (const bm of bms) {
      if (!testsCache[bm.testId]) {
        const t = await fetchTest(bm.testId);
        if (t) testsCache[bm.testId] = t;
      }
      const test = testsCache[bm.testId];
      if (test) {
        const q = test.questions.find((item) => item.n === bm.qNum);
        if (q) {
          bmQuestionsMap[bm.id] = { question: q, testTitle: test.title };
        }
      }
    }
    setBookmarkedQuestions(bmQuestionsMap);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [fetchTest]);

  // Tab switch
  const handleTabChange = (tab: "mistakes" | "bookmarks") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Re-attempt an inline question
  const handleSelectReattemptOption = (key: string, optionIndex: number) => {
    setReattempts((prev) => ({
      ...prev,
      [key]: { selectedOpt: optionIndex, isSubmitted: false, isCorrect: false },
    }));
  };

  const handleSubmitReattempt = async (
    key: string,
    correctAnswer: number,
    qNum: number
  ) => {
    const state = reattempts[key];
    if (!state || state.selectedOpt === null) return;

    const isCorrect = state.selectedOpt === correctAnswer;
    setReattempts((prev) => ({
      ...prev,
      [key]: { ...state, isSubmitted: true, isCorrect },
    }));

    if (isCorrect) {
      playCorrectSound();
      await saveMasteredMistake(key, true);
      setMasteredMap((prev) => ({ ...prev, [key]: true }));
      await addPracticeStats(15, 1, 1);
    } else {
      playWrongSound();
    }
  };

  const handleToggleMastery = async (key: string) => {
    const next = !masteredMap[key];
    await saveMasteredMistake(key, next);
    setMasteredMap((prev) => ({ ...prev, [key]: next }));
  };

  const handleSaveNote = async (key: string) => {
    await saveMistakeNote(key, currentNoteText);
    setNotesMap((prev) => ({ ...prev, [key]: currentNoteText }));
    setEditingNoteKey(null);
  };

  const handleDeleteBookmark = async (id: string) => {
    await removeBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  // Filtered mistakes list
  const filteredMistakes = useMemo(() => {
    return mistakes.filter((item) => {
      if (selectedTestId !== "all" && item.testId !== selectedTestId) {
        return false;
      }
      if (selectedSection !== "all" && item.section !== selectedSection) {
        return false;
      }
      const isMastered = Boolean(masteredMap[item.key]);
      if (masteryFilter === "unmastered" && isMastered) return false;
      if (masteryFilter === "mastered" && !isMastered) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTopic = item.topic.toLowerCase().includes(query);
        const matchesStem = item.question.stem.toLowerCase().includes(query);
        if (!matchesTopic && !matchesStem) return false;
      }

      return true;
    });
  }, [
    mistakes,
    selectedTestId,
    selectedSection,
    masteryFilter,
    searchQuery,
    masteredMap,
  ]);

  // Export filtered mistakes to CSV
  const handleExportMistakes = () => {
    const exportData: MistakeExportItem[] = filteredMistakes.map((m) => {
      const letters = ["A", "B", "C", "D"];
      return {
        testId: m.testId,
        testTitle: m.testTitle,
        qNum: m.question.n,
        section: m.section,
        topic: m.topic,
        stem: m.question.stem,
        chosenOption:
          m.userAnswer !== undefined ? `Option ${letters[m.userAnswer]}` : "Skipped",
        correctOption: `Option ${letters[m.correctAnswer]}`,
        isMastered: Boolean(masteredMap[m.key]),
        notes: notesMap[m.key],
      };
    });
    exportMistakesToCsv(exportData);
  };

  // Export bookmarks to CSV
  const handleExportBookmarks = () => {
    const exportData: BookmarkExportItem[] = bookmarks.map((b) => {
      const qData = bookmarkedQuestions[b.id];
      return {
        testId: b.testId,
        testTitle: qData?.testTitle,
        qNum: b.qNum,
        topic: b.topic,
        stem: qData?.question.stem,
        dateAdded: new Date(b.dateAdded).toISOString().split("T")[0],
        note: b.note,
      };
    });
    exportBookmarksToCsv(exportData);
  };

  // Launch targeted practice session with first available test
  const handleLaunchPracticeMistakes = () => {
    const targetTest = filteredMistakes[0]?.testId || manifest?.tests[0]?.id;
    if (targetTest) {
      navigate(`/practice/${targetTest}?onlyWrong=1`);
    }
  };

  const optionLetters = ["A", "B", "C", "D"];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 print:hidden">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
            <BookmarkCheck className="w-3.5 h-3.5" />
            Active Revision Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Mistake Notebook & Saved Bookmarks
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
            Turn previous mistakes into high exam marks. Re-attempt questions with instant checking, master concepts, and jot down personal memory tricks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeTab === "mistakes" ? (
            <>
              <button
                onClick={handleLaunchPracticeMistakes}
                disabled={filteredMistakes.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition shadow-sm disabled:opacity-40"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                Practice Mistakes
              </button>
              <button
                onClick={handleExportMistakes}
                disabled={filteredMistakes.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Export CSV
              </button>
            </>
          ) : (
            <button
              onClick={handleExportBookmarks}
              disabled={bookmarks.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export Bookmarks CSV
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            title="Print Notebook"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Switcher: Mistake Notebook vs Bookmarks */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 print:hidden">
        <button
          onClick={() => handleTabChange("mistakes")}
          className={`pb-3.5 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "mistakes"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <XCircle className="w-4 h-4" />
          Mistake Notebook ({mistakes.length})
        </button>

        <button
          onClick={() => handleTabChange("bookmarks")}
          className={`pb-3.5 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "bookmarks"
              ? "border-blue-600 text-blue-600 dark:text-sky-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Saved Bookmarks ({bookmarks.length})
        </button>
      </div>

      {/* Mistake Notebook Tab Content */}
      {activeTab === "mistakes" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Paper selector */}
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Test Papers</option>
                {manifest?.tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>

              {/* Section selector */}
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Sections</option>
                <option value="reasoning">Reasoning</option>
                <option value="general_awareness">General Awareness</option>
                <option value="quantitative_aptitude">Quantitative Aptitude</option>
                <option value="english">English Comprehension</option>
              </select>

              {/* Mastery filter pills */}
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 text-xs font-bold">
                <button
                  onClick={() => setMasteryFilter("unmastered")}
                  className={`px-3 py-1 rounded-lg transition ${
                    masteryFilter === "unmastered"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  Needs Review ({mistakes.filter((m) => !masteredMap[m.key]).length})
                </button>
                <button
                  onClick={() => setMasteryFilter("mastered")}
                  className={`px-3 py-1 rounded-lg transition ${
                    masteryFilter === "mastered"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  Mastered ({mistakes.filter((m) => masteredMap[m.key]).length})
                </button>
                <button
                  onClick={() => setMasteryFilter("all")}
                  className={`px-3 py-1 rounded-lg transition ${
                    masteryFilter === "all"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  All ({mistakes.length})
                </button>
              </div>
            </div>

            {/* Topic search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search topic or stem..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Mistakes List */}
          {filteredMistakes.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                No mistakes match your criteria!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {mistakes.length === 0
                  ? "Take a full mock test or practice lesson. Any wrong answers will be collected here for systematic mastery."
                  : "Try clearing filters or switching between 'Needs Review' and 'Mastered'."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMistakes.map((item) => {
                const isMastered = Boolean(masteredMap[item.key]);
                const reattempt = reattempts[item.key];
                const note = notesMap[item.key];
                const isEditingNote = editingNoteKey === item.key;

                return (
                  <div
                    key={item.key}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                  >
                    {/* Header bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs flex items-center justify-center">
                          {item.question.n}
                        </span>
                        <span className="text-xs font-bold text-slate-500 truncate max-w-xs">
                          {item.testTitle}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-sky-400">
                          {item.topic}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isMastered ? (
                          <button
                            onClick={() => handleToggleMastery(item.key)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-200 transition"
                          >
                            <Check className="w-3.5 h-3.5" /> Mastered
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleMastery(item.key)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-bold text-xs hover:bg-amber-200 transition"
                          >
                            Needs Review
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Question Stem */}
                    <div className="space-y-3">
                      {item.question.render_mode === "image_full" && item.question.full_image ? (
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 inline-block max-w-full">
                          <span className="sr-only">{item.question.stem || `Question ${item.question.n}`}</span>
                          <img
                            src={item.question.full_image.startsWith("data/") || item.question.full_image.startsWith("/") ? item.question.full_image : `data/${item.question.full_image}`}
                            alt={`Question ${item.question.n}`}
                            className="max-h-72 rounded-lg object-contain bg-white"
                          />
                        </div>
                      ) : item.question.render_mode === "image_stem" && item.question.stem_image ? (
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 inline-block max-w-full">
                          <span className="sr-only">{item.question.stem || `Question ${item.question.n}`}</span>
                          <img
                            src={item.question.stem_image.startsWith("data/") || item.question.stem_image.startsWith("/") ? item.question.stem_image : `data/${item.question.stem_image}`}
                            alt={`Figure ${item.question.n}`}
                            className="max-h-56 rounded-lg object-contain bg-white border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      ) : (
                        <QuestionBlocksRenderer
                          blocks={item.question.blocks}
                          fallbackStem={item.question.stem}
                        />
                      )}
                    </div>

                    {/* Interactive Re-attempt Option Buttons */}
                    <div className="space-y-2 pt-1">
                      <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
                        <span>Options (Click to re-solve without looking at solution):</span>
                        {reattempt?.isSubmitted && (
                          <span
                            className={`font-black ${
                              reattempt.isCorrect ? "text-emerald-600" : "text-rose-500"
                            }`}
                          >
                            {reattempt.isCorrect ? "✓ Correct! (+15 XP)" : "✕ Incorrect"}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {item.question.options.map((optText, optIdx) => {
                          const isSelected = reattempt?.selectedOpt === optIdx;
                          const wasOriginalWrong = item.userAnswer === optIdx;
                          const isOfficialCorrect = item.correctAnswer === optIdx;

                          let btnClasses =
                            "p-3 rounded-xl border text-xs sm:text-sm text-left flex items-center justify-between transition ";

                          if (reattempt?.isSubmitted) {
                            if (isOfficialCorrect) {
                              btnClasses +=
                                "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold ";
                            } else if (isSelected) {
                              btnClasses +=
                                "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-rose-200 font-bold ";
                            } else {
                              btnClasses +=
                                "border-slate-200 dark:border-slate-800 text-slate-400 opacity-60 ";
                            }
                          } else {
                            if (isSelected) {
                              btnClasses +=
                                "bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-900 dark:text-sky-200 font-bold ";
                            } else {
                              btnClasses +=
                                "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 ";
                            }
                          }

                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleSelectReattemptOption(item.key, optIdx)}
                              className={btnClasses}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center text-xs shrink-0">
                                  {optionLetters[optIdx]}
                                </span>
                                <span>{optText || `Option (${optionLetters[optIdx]})`}</span>
                              </div>

                              {!reattempt?.isSubmitted && wasOriginalWrong && (
                                <span className="text-[10px] font-bold text-rose-500 uppercase">
                                  Prev Choice
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Check Answer Button */}
                      {reattempt?.selectedOpt !== null && !reattempt?.isSubmitted && (
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() =>
                              handleSubmitReattempt(
                                item.key,
                                item.correctAnswer,
                                item.question.n
                              )
                            }
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition"
                          >
                            Verify Re-attempt
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Explanatory Solution Box */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Official Solution: Option ({optionLetters[item.correctAnswer]})</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {item.userAnswer === undefined
                          ? "You skipped this question during the original test."
                          : `In your test, you selected Option (${optionLetters[item.userAnswer]}). Ensure you understand the distinction before moving on.`}
                      </p>
                    </div>

                    {/* Personal Reflection Note */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      {isEditingNote ? (
                        <div className="space-y-2">
                          <label className="font-bold text-slate-700 dark:text-slate-300">
                            Personal Memory Note / Formula Tip:
                          </label>
                          <textarea
                            rows={2}
                            value={currentNoteText}
                            onChange={(e) => setCurrentNoteText(e.target.value)}
                            placeholder="e.g. Remember to check unit conversion km/h -> m/s (* 5/18)..."
                            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveNote(item.key)}
                              className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg text-xs"
                            >
                              Save Note
                            </button>
                            <button
                              onClick={() => setEditingNoteKey(null)}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-lg text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              {note ? `Tip: "${note}"` : "No reflection note added."}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setEditingNoteKey(item.key);
                              setCurrentNoteText(note || "");
                            }}
                            className="text-blue-600 dark:text-sky-400 font-bold hover:underline"
                          >
                            {note ? "Edit Note" : "+ Add Note"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Saved Bookmarks Tab Content */}
      {activeTab === "bookmarks" && (
        <div className="space-y-4">
          {bookmarks.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700 space-y-3">
              <Bookmark className="w-10 h-10 text-blue-500 mx-auto" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                No Bookmarked Questions Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                While taking an exam or practicing, click the bookmark icon on any question to save it here for fast revision before your exam!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookmarks.map((bm) => {
                const qData = bookmarkedQuestions[bm.id];
                const dateStr = new Date(bm.dateAdded).toLocaleDateString();

                return (
                  <div
                    key={bm.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-sky-400">
                          {bm.topic}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {dateStr}
                          </span>
                          <button
                            onClick={() => handleDeleteBookmark(bm.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded transition"
                            title="Remove bookmark"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1">
                        {qData?.testTitle || bm.testId} • Q{bm.qNum}
                      </h4>

                      {qData?.question?.stem && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                          {qData.question.stem}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <Link
                        to={`/practice/${bm.testId}`}
                        className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-sky-400 hover:underline"
                      >
                        <Play className="w-3.5 h-3.5" /> Practice in Test
                      </Link>

                      <span className="text-[11px] text-slate-400 italic">
                        {bm.note || "No custom note"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

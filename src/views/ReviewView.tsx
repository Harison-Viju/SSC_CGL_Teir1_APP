/**
 * ReviewView: Question Quality & Verification Workbench (#/review).
 * Dual-pane side-by-side inspection: Rendered Question vs Original PDF Crop.
 * Filters for warnings, confidence, and image modes, with a 1-click 'Looks Wrong' override generator.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Maximize2,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Table as TableIcon,
  Sparkles,
  ArrowRight,
  X,
  ExternalLink,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { QuestionBlocksRenderer } from "../components/QuestionBlocksRenderer";
import type { ExamTest, Question } from "../types";

export const ReviewView: React.FC = () => {
  const { testId: paramTestId } = useParams<{ testId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { manifest, fetchManifest, fetchTest } = useAppStore();

  const [selectedTestId, setSelectedTestId] = useState<string>(
    paramTestId || searchParams.get("test") || "ssc-cgl-2026-10-05"
  );
  const [test, setTest] = useState<ExamTest | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterMode, setFilterMode] = useState<"all" | "warnings" | "low_conf" | "images" | "tables">("all");
  const [selectedQNum, setSelectedQNum] = useState<number>(54);

  // Modals & UI states
  const [isZoomed, setIsZoomed] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideCopied, setOverrideCopied] = useState(false);
  const [overrideSaved, setOverrideSaved] = useState(false);
  const [overrideNotes, setOverrideNotes] = useState("");

  // Ensure manifest is loaded
  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  // Load test data
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTest(selectedTestId).then((t) => {
      if (active) {
        setTest(t);
        setLoading(false);
        // Default to Q54 or first question
        if (t && t.questions.length > 0) {
          const q54 = t.questions.find((q) => q.n === 54);
          if (q54) {
            setSelectedQNum(54);
          } else {
            setSelectedQNum(t.questions[0].n);
          }
        }
      }
    });
    return () => {
      active = false;
    };
  }, [selectedTestId, fetchTest]);

  // Sync test ID in URL
  const handleSelectPaper = (id: string) => {
    setSelectedTestId(id);
    setSearchParams({ test: id });
  };

  const questions = test?.questions || [];

  // Filter questions
  const filteredQuestions = useMemo(() => {
    if (!questions.length) return [];
    switch (filterMode) {
      case "warnings":
        return questions.filter((q) => (q.warnings && q.warnings.length > 0));
      case "low_conf":
        return questions.filter((q) => (q.confidence || 1.0) < 0.9);
      case "images":
        return questions.filter((q) => q.render_mode !== "text");
      case "tables":
        return questions.filter(
          (q) => Boolean(q.table) || q.stem.toLowerCase().includes("table") || q.stem.toLowerCase().includes("students")
        );
      default:
        return questions;
    }
  }, [questions, filterMode]);

  // Current question
  const currentQuestion = useMemo(() => {
    return questions.find((q) => q.n === selectedQNum) || filteredQuestions[0] || questions[0];
  }, [questions, selectedQNum, filteredQuestions]);

  // Update selectedQNum when filteredQuestions changes
  useEffect(() => {
    if (filteredQuestions.length > 0 && !filteredQuestions.some((q) => q.n === selectedQNum)) {
      setSelectedQNum(filteredQuestions[0].n);
    }
  }, [filteredQuestions, selectedQNum]);

  // Navigation handlers
  const handlePrev = () => {
    if (!filteredQuestions.length) return;
    const currentIndex = filteredQuestions.findIndex((q) => q.n === currentQuestion?.n);
    if (currentIndex > 0) {
      setSelectedQNum(filteredQuestions[currentIndex - 1].n);
    }
  };

  const handleNext = () => {
    if (!filteredQuestions.length) return;
    const currentIndex = filteredQuestions.findIndex((q) => q.n === currentQuestion?.n);
    if (currentIndex < filteredQuestions.length - 1) {
      setSelectedQNum(filteredQuestions[currentIndex + 1].n);
    }
  };

  // Image helpers
  const getImageSrc = (imgPath?: string | null) => {
    if (!imgPath) return "";
    if (imgPath.startsWith("data:") || imgPath.startsWith("http") || imgPath.startsWith("/")) {
      return imgPath;
    }
    if (imgPath.startsWith("data/")) return `/${imgPath}`;
    return `/data/${imgPath}`;
  };

  const origImageSrc = currentQuestion
    ? getImageSrc(currentQuestion.orig_image || currentQuestion.stem_image || currentQuestion.full_image)
    : "";

  // Override skeleton generator
  const overrideSkeleton = useMemo(() => {
    if (!currentQuestion) return "{}";
    const skeleton = {
      [String(currentQuestion.n)]: {
        n: currentQuestion.n,
        render_mode: currentQuestion.render_mode,
        answer: currentQuestion.answer ?? 0,
        topic: currentQuestion.topic,
        note: overrideNotes.trim() || "Flagged in review inspection",
        options: currentQuestion.options,
        timestamp: new Date().toISOString(),
      },
    };
    return JSON.stringify(skeleton, null, 2);
  }, [currentQuestion, overrideNotes]);

  const copyOverride = () => {
    navigator.clipboard.writeText(overrideSkeleton);
    setOverrideCopied(true);
    setTimeout(() => setOverrideCopied(false), 2000);
  };

  const saveLocalOverride = () => {
    if (!currentQuestion) return;
    try {
      const key = `examquest-overrides-${selectedTestId}`;
      const existing = JSON.parse(localStorage.getItem(key) || "{}");
      existing[String(currentQuestion.n)] = JSON.parse(overrideSkeleton)[String(currentQuestion.n)];
      localStorage.setItem(key, JSON.stringify(existing, null, 2));
      setOverrideSaved(true);
      setTimeout(() => setOverrideSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save local override:", e);
    }
  };

  const optionLetters = ["A", "B", "C", "D", "E"];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Header & Paper Selector */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sticky top-16 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Title & Paper Picker */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Question Quality Review
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
                  Ground Truth
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dual-pane inspection: compare parsed output directly with original PDF crops
              </p>
            </div>
          </div>

          {/* Paper Select Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="paper-select" className="text-xs font-semibold text-slate-500 shrink-0">
              Paper:
            </label>
            <select
              id="paper-select"
              value={selectedTestId}
              onChange={(e) => handleSelectPaper(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {manifest?.tests?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.date})
                </option>
              )) || <option value={selectedTestId}>{selectedTestId}</option>}
            </select>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2.5">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              All ({questions.length})
            </button>
            <button
              onClick={() => setFilterMode("warnings")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === "warnings"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>Warnings ({questions.filter((q) => q.warnings?.length).length})</span>
            </button>
            <button
              onClick={() => setFilterMode("low_conf")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "low_conf"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              Low Conf ({questions.filter((q) => (q.confidence || 1.0) < 0.9).length})
            </button>
            <button
              onClick={() => setFilterMode("images")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "images"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              Image Modes ({questions.filter((q) => q.render_mode !== "text").length})
            </button>
            <button
              onClick={() => setFilterMode("tables")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === "tables"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <TableIcon className="w-3 h-3 text-teal-500" />
              <span>Tables</span>
            </button>
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Q{currentQuestion?.n} of {questions.length} (Filter: {filteredQuestions.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                disabled={filteredQuestions.findIndex((q) => q.n === currentQuestion?.n) <= 0}
                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Previous question"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                disabled={
                  filteredQuestions.findIndex((q) => q.n === currentQuestion?.n) >=
                  filteredQuestions.length - 1
                }
                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Next question"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual-Pane Inspection Workbench */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Pane: Rendered Question */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col shadow-xs overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-black text-xs">
                Q{currentQuestion?.n}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {currentQuestion?.topic}
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase">
                {currentQuestion?.render_mode}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                  (currentQuestion?.confidence || 1.0) >= 0.95
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                }`}
              >
                Conf: {currentQuestion?.confidence?.toFixed(2)}
              </span>
            </div>

            {/* Looks Wrong Action Button */}
            <button
              onClick={() => setShowOverrideModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 text-rose-600 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold text-xs transition-colors cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Looks Wrong</span>
            </button>
          </div>

          {/* Warnings Banner if any */}
          {currentQuestion?.warnings && currentQuestion.warnings.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Parser Quality Warnings ({currentQuestion.warnings.length}):</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                {currentQuestion.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Rendered Question Body */}
          <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-4">
            {/* If table is present */}
            {currentQuestion?.table && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
                <table className="min-w-full text-xs sm:text-sm text-left border-collapse">
                  {currentQuestion.table.headers && currentQuestion.table.headers.length > 0 && (
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        {currentQuestion.table.headers.map((h, i) => (
                          <th key={i} className="px-3 py-2 border-r last:border-r-0 border-slate-200 dark:border-slate-700">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {currentQuestion.table.rows &&
                      currentQuestion.table.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="border-b last:border-b-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-800 font-mono">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Stem Blocks or text */}
            {currentQuestion?.blocks && currentQuestion.blocks.length > 0 ? (
              <QuestionBlocksRenderer
                blocks={currentQuestion.blocks}
                fallbackStem={currentQuestion.stem}
              />
            ) : (
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                {currentQuestion?.stem}
              </p>
            )}

            {/* Options list */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Options ({currentQuestion?.options?.length}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentQuestion?.options?.map((opt, idx) => {
                  const isAnswer = idx === currentQuestion.answer;
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${
                        isAnswer
                          ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-bold ring-1 ring-emerald-400"
                          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 border ${
                            isAnswer
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {optionLetters[idx]}
                        </span>
                        <span className="break-words">{opt}</span>
                      </div>
                      {isAnswer && (
                        <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                          Answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Original PDF Crop */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col shadow-xs overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                Original Exam Paper Crop
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                (Page {currentQuestion?._bbox?.page || 1})
              </span>
            </div>
            {origImageSrc && (
              <button
                onClick={() => setIsZoomed(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                title="Zoom original crop"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Zoom</span>
              </button>
            )}
          </div>

          {/* Original Crop Viewport */}
          <div className="flex-1 min-h-[350px] overflow-auto p-2 flex items-center justify-center bg-slate-50 dark:bg-slate-950/70 rounded-xl mt-3 border border-slate-100 dark:border-slate-800">
            {origImageSrc ? (
              <img
                src={origImageSrc}
                alt={`Original crop for Q${currentQuestion?.n}`}
                className="max-h-[500px] w-auto max-w-full object-contain rounded cursor-pointer"
                onClick={() => setIsZoomed(true)}
              />
            ) : (
              <div className="text-center p-6 text-slate-400 text-xs">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No figure crop required for standard text questions.</p>
                <p className="text-[11px] opacity-75 mt-1">
                  Click 'Looks Wrong' to force high-resolution crop for this question.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Zoom Modal */}
      {isZoomed && origImageSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] flex flex-col items-center bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl shadow-2xl overflow-auto border border-slate-700"
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
              src={origImageSrc}
              alt={`Question ${currentQuestion?.n} zoomed`}
              className="max-h-[85vh] w-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Looks Wrong: Override Template Modal */}
      {showOverrideModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowOverrideModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                Question Override Template: Q{currentQuestion?.n}
              </h3>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              This creates an entry ready for <code className="font-mono text-sky-600 dark:text-sky-400">overrides/{selectedTestId}.json</code> to patch this question during ingestion.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Correction Note / Rationale:
              </label>
              <input
                type="text"
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                placeholder="e.g. Table headers flattened or option text OCR typo"
                className="w-full text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Generated Override JSON:
              </label>
              <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-48 border border-slate-800">
                {overrideSkeleton}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-500">
                Target: overrides/{selectedTestId}.json
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveLocalOverride}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1"
                >
                  {overrideSaved ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : null}
                  <span>{overrideSaved ? "Saved Locally" : "Save in Browser"}</span>
                </button>
                <button
                  onClick={copyOverride}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {overrideCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{overrideCopied ? "Copied!" : "Copy Skeleton JSON"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

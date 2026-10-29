/**
 * Library View: Catalog of all ingested previous-year and memory-based papers.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  BookOpen,
  Calendar,
  Clock,
  Layers,
  Sparkles,
  Play,
  ArrowUpDown,
  Image as ImageIcon,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { TestManifestEntry } from "../types";

export const LibraryView: React.FC = () => {
  const { manifest, fetchManifest, loadingManifest } = useAppStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "2026" | "2025" | "figures">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  const filteredTests = useMemo(() => {
    if (!manifest?.tests) return [];

    return manifest.tests
      .filter((t: TestManifestEntry) => {
        // Search filter
        const matchSearch =
          t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.id.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchSearch) return false;

        // Category filter
        if (selectedFilter === "2026") {
          return t.date.startsWith("2026");
        }
        if (selectedFilter === "2025") {
          return t.date.startsWith("2025");
        }
        if (selectedFilter === "figures") {
          const totalFigures =
            (t.render_mode_counts?.image_full || 0) + (t.render_mode_counts?.image_stem || 0);
          return totalFigures > 0;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === "newest") {
          return b.date.localeCompare(a.date);
        } else {
          return a.date.localeCompare(b.date);
        }
      });
  }, [manifest, searchTerm, selectedFilter, sortOrder]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-blue-600 dark:text-sky-400" />
            Exam Papers Library
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Browse genuine previous-year & memory-based question papers with automated scoring.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>{filteredTests.length} Papers Available</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by date, paper title, or shift..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        {/* Filter Pills & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
            {(
              [
                { id: "all", label: "All Papers" },
                { id: "2026", label: "2026 Papers" },
                { id: "2025", label: "2025 Papers" },
                { id: "figures", label: "With Diagrams" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  selectedFilter === filter.id
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === "newest" ? "Newest First" : "Oldest First"}
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loadingManifest && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Test Cards Grid */}
      {!loadingManifest && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTests.map((test) => {
            const figureCount =
              (test.render_mode_counts?.image_full || 0) +
              (test.render_mode_counts?.image_stem || 0);

            return (
              <div
                key={test.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Top metadata tags */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-sky-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full">
                      <Calendar className="w-3.5 h-3.5" />
                      {test.date}
                    </span>
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      60 mins
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="font-extrabold text-slate-900 dark:text-white text-base leading-snug group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
                    {test.title}
                  </h2>

                  {/* Info stats */}
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      100 Questions
                    </span>
                    <span>•</span>
                    <span>+2 / -0.5 Marking</span>
                    {figureCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                          <ImageIcon className="w-3.5 h-3.5" />
                          {figureCount} Visual Diagrams
                        </span>
                      </>
                    )}
                  </div>

                  {/* Sections Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {test.sections.map((sec) => (
                      <span
                        key={sec.id}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300"
                      >
                        {sec.name.split(" ")[0]} ({sec.count})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action buttons */}
                <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
                  <Link
                    to={`/test/${test.id}`}
                    className="flex-1 text-center py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors"
                  >
                    View Details
                  </Link>
                  <Link
                    to={`/exam/${test.id}?mode=full`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-transform active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Mock Test
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty Search Result State */}
      {!loadingManifest && filteredTests.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3">
          <p className="text-slate-500 font-medium text-base">
            No papers found matching "{searchTerm}".
          </p>
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedFilter("all");
            }}
            className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl shadow"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};

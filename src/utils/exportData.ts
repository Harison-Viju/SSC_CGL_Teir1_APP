/**
 * Utilities for CSV data export and printable report generation.
 */

import type { TestAttemptSummary } from "../types";

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function triggerDownload(content: string, filename: string, mimeType = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export full mock test attempt history as a CSV file.
 */
export function exportAttemptsToCsv(attempts: TestAttemptSummary[]): void {
  const headers = [
    "Attempt ID",
    "Date",
    "Test Title",
    "Mode",
    "Score",
    "Max Score",
    "Accuracy (%)",
    "Total Questions",
    "Attempted",
    "Correct",
    "Wrong",
    "Skipped",
    "Time Spent (Mins)",
    "Reasoning Score",
    "General Awareness Score",
    "Quantitative Aptitude Score",
    "English Score",
  ];

  const rows = attempts.map((att) => {
    const timeMins = (att.timeSpentSeconds / 60).toFixed(1);
    const reasoning = att.sectionScores?.reasoning?.score ?? "";
    const ga = att.sectionScores?.general_awareness?.score ?? "";
    const quant = att.sectionScores?.quantitative_aptitude?.score ?? "";
    const english = att.sectionScores?.english?.score ?? "";

    return [
      escapeCsvCell(att.id),
      escapeCsvCell(att.date),
      escapeCsvCell(att.testTitle),
      escapeCsvCell(att.mode.toUpperCase()),
      escapeCsvCell(att.score.toFixed(2)),
      escapeCsvCell(att.maxScore),
      escapeCsvCell(`${att.accuracy}%`),
      escapeCsvCell(att.totalQuestions),
      escapeCsvCell(att.attempted),
      escapeCsvCell(att.correct),
      escapeCsvCell(att.wrong),
      escapeCsvCell(att.skipped),
      escapeCsvCell(timeMins),
      escapeCsvCell(reasoning),
      escapeCsvCell(ga),
      escapeCsvCell(quant),
      escapeCsvCell(english),
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const today = new Date().toISOString().split("T")[0];
  triggerDownload(csvContent, `ExamQuest_Attempt_History_${today}.csv`);
}

/**
 * Export mistakes notebook data to CSV.
 */
export interface MistakeExportItem {
  testId: string;
  testTitle: string;
  qNum: number;
  section: string;
  topic: string;
  stem: string;
  chosenOption?: string;
  correctOption: string;
  isMastered: boolean;
  notes?: string;
}

export function exportMistakesToCsv(items: MistakeExportItem[]): void {
  const headers = [
    "Test Paper",
    "Q#",
    "Section",
    "Topic",
    "Question Stem",
    "Your Answer",
    "Correct Answer",
    "Status",
    "Personal Notes",
  ];

  const rows = items.map((item) => {
    return [
      escapeCsvCell(item.testTitle || item.testId),
      escapeCsvCell(item.qNum),
      escapeCsvCell(item.section),
      escapeCsvCell(item.topic),
      escapeCsvCell(item.stem.slice(0, 150)),
      escapeCsvCell(item.chosenOption || "Skipped"),
      escapeCsvCell(item.correctOption),
      escapeCsvCell(item.isMastered ? "Mastered" : "Needs Review"),
      escapeCsvCell(item.notes || ""),
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const today = new Date().toISOString().split("T")[0];
  triggerDownload(csvContent, `ExamQuest_Mistake_Notebook_${today}.csv`);
}

/**
 * Export bookmarked questions to CSV.
 */
export interface BookmarkExportItem {
  testId: string;
  testTitle?: string;
  qNum: number;
  topic: string;
  stem?: string;
  dateAdded: string;
  note?: string;
}

export function exportBookmarksToCsv(items: BookmarkExportItem[]): void {
  const headers = [
    "Test Paper",
    "Q#",
    "Topic",
    "Question Stem",
    "Date Added",
    "Personal Note",
  ];

  const rows = items.map((item) => {
    return [
      escapeCsvCell(item.testTitle || item.testId),
      escapeCsvCell(item.qNum),
      escapeCsvCell(item.topic),
      escapeCsvCell((item.stem || "").slice(0, 150)),
      escapeCsvCell(item.dateAdded),
      escapeCsvCell(item.note || ""),
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const today = new Date().toISOString().split("T")[0];
  triggerDownload(csvContent, `ExamQuest_Bookmarks_${today}.csv`);
}

/**
 * Pure helper functions for ExamQuest test timing, palette status, and scoring.
 */

import type {
  ExamTest,
  PaletteStatus,
  TestAttemptSummary,
} from "../types";

export function formatTime(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getQuestionStatus(
  qNum: number,
  answers: Record<number, number>,
  markedForReview: Record<number, boolean>,
  visited: Record<number, boolean>
): PaletteStatus {
  const hasAnswer = answers[qNum] !== undefined;
  const isMarked = Boolean(markedForReview[qNum]);
  const isVisited = Boolean(visited[qNum]);

  if (hasAnswer && isMarked) {
    return "answered_and_marked";
  }
  if (isMarked) {
    return "marked_for_review";
  }
  if (hasAnswer) {
    return "answered";
  }
  if (isVisited) {
    return "not_answered";
  }
  return "not_visited";
}

export function computeAttemptSummary(
  test: ExamTest,
  mode: "full" | "section" | "practice" | "mistake_review",
  answers: Record<number, number>,
  timeSpentPerQuestion: Record<number, number>,
  startedAt: number,
  endedAt: number,
  selectedQuestions?: number[]
): TestAttemptSummary {
  const questions = selectedQuestions
    ? test.questions.filter((q) => selectedQuestions.includes(q.n))
    : test.questions;

  const marking = test.marking || { correct: 2.0, wrong: -0.5, unanswered: 0.0 };

  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  const sectionScores: TestAttemptSummary["sectionScores"] = {};
  const topicStats: TestAttemptSummary["topicStats"] = {};

  // Initialize section stats
  for (const s of test.sections) {
    sectionScores[s.id] = {
      score: 0,
      maxScore: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      timeSpentSeconds: 0,
    };
  }

  for (const q of questions) {
    const userChoice = answers[q.n];
    const secId = q.section || "general";
    const topic = q.topic || "General";
    const timeSpent = timeSpentPerQuestion[q.n] || 0;

    if (!sectionScores[secId]) {
      sectionScores[secId] = {
        score: 0,
        maxScore: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        timeSpentSeconds: 0,
      };
    }
    sectionScores[secId].maxScore += marking.correct;
    sectionScores[secId].timeSpentSeconds += timeSpent;

    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0, wrong: 0 };
    }
    topicStats[topic].total += 1;

    if (userChoice === undefined) {
      skippedCount += 1;
      sectionScores[secId].skipped += 1;
      totalScore += marking.unanswered;
    } else if (userChoice === q.answer) {
      correctCount += 1;
      sectionScores[secId].correct += 1;
      sectionScores[secId].score += marking.correct;
      totalScore += marking.correct;
      topicStats[topic].correct += 1;
    } else {
      wrongCount += 1;
      sectionScores[secId].wrong += 1;
      sectionScores[secId].score += marking.wrong;
      totalScore += marking.wrong;
      topicStats[topic].wrong += 1;
    }
  }

  const attempted = correctCount + wrongCount;
  const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;
  const maxScore = questions.length * marking.correct;
  const totalDurationSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000));

  return {
    id: `attempt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    testId: test.id,
    testTitle: test.title,
    mode,
    date: new Date(endedAt).toISOString().split("T")[0],
    timestamp: endedAt,
    score: Math.round(totalScore * 100) / 100,
    maxScore,
    accuracy,
    timeSpentSeconds: totalDurationSeconds,
    totalQuestions: questions.length,
    attempted,
    correct: correctCount,
    wrong: wrongCount,
    skipped: skippedCount,
    sectionScores,
    topicStats,
    userAnswers: answers,
    timeSpentPerQuestion,
  };
}

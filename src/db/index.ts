/**
 * Dexie IndexedDB client for local-first storage in ExamQuest.
 */

import Dexie, { type Table } from "dexie";
import type {
  TestAttemptSummary,
  Bookmark,
  QuestionFlag,
  InProgressAttempt,
  UserStats,
  QuestionStat,
  ExamTest,
} from "../types";

export class ExamQuestDatabase extends Dexie {
  attempts!: Table<TestAttemptSummary, string>;
  bookmarks!: Table<Bookmark, string>;
  flags!: Table<QuestionFlag, string>;
  inProgress!: Table<InProgressAttempt, string>;
  stats!: Table<UserStats & { id: string }, string>;
  keyValSettings!: Table<{ key: string; value: any }, string>;
  questionStats!: Table<QuestionStat, string>;

  constructor() {
    super("ExamQuestDB");
    this.version(1).stores({
      attempts: "id, testId, timestamp, mode, score",
      bookmarks: "id, testId, qNum, dateAdded",
      flags: "id, testId, qNum, dateAdded",
      inProgress: "testId, lastUpdated",
      stats: "id",
      keyValSettings: "key",
    });
    this.version(2).stores({
      questionStats: "qkey, lastResult, lastAnsweredAt",
    });
  }
}

export const db = new ExamQuestDatabase();

export async function getUserStats(): Promise<UserStats> {
  const existing = await db.stats.get("user_stats");
  if (existing) {
    return existing;
  }
  const initial: UserStats = {
    xp: 0,
    streak: 0,
    lastActiveDate: new Date().toISOString().split("T")[0],
    completedTestsCount: 0,
    totalAnswered: 0,
    totalCorrect: 0,
  };
  await db.stats.put({ ...initial, id: "user_stats" });
  return initial;
}

export async function saveUserStats(stats: UserStats): Promise<void> {
  await db.stats.put({ ...stats, id: "user_stats" });
}

export async function getInProgressAttempt(testId: string): Promise<InProgressAttempt | undefined> {
  return await db.inProgress.get(testId);
}

export async function getAllInProgressAttempts(): Promise<InProgressAttempt[]> {
  return await db.inProgress.toArray();
}

export async function saveInProgressAttempt(attempt: InProgressAttempt): Promise<void> {
  await db.inProgress.put(attempt);
}

export async function clearInProgressAttempt(testId: string): Promise<void> {
  await db.inProgress.delete(testId);
}

export async function saveAttemptSummary(summary: TestAttemptSummary): Promise<void> {
  await db.attempts.put(summary);
  // Update user stats
  const stats = await getUserStats();
  const today = new Date().toISOString().split("T")[0];
  const lastDate = stats.lastActiveDate;
  
  let newStreak = stats.streak;
  if (lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  }

  const earnedXp = Math.max(20, Math.round(summary.score * 5) + summary.correct * 10);

  await saveUserStats({
    ...stats,
    xp: stats.xp + earnedXp,
    streak: newStreak,
    lastActiveDate: today,
    completedTestsCount: stats.completedTestsCount + 1,
    totalAnswered: stats.totalAnswered + summary.attempted,
    totalCorrect: stats.totalCorrect + summary.correct,
  });
}

export async function getAllAttempts(): Promise<TestAttemptSummary[]> {
  return await db.attempts.orderBy("timestamp").reverse().toArray();
}

export async function getAttemptsForTest(testId: string): Promise<TestAttemptSummary[]> {
  return await db.attempts.where("testId").equals(testId).reverse().sortBy("timestamp");
}

export async function recordPracticeSession(
  earnedXp: number,
  answeredCount: number,
  correctCount: number
): Promise<UserStats> {
  const stats = await getUserStats();
  const today = new Date().toISOString().split("T")[0];
  const lastDate = stats.lastActiveDate;

  let newStreak = stats.streak;
  if (lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  }

  const updated: UserStats = {
    ...stats,
    xp: stats.xp + earnedXp,
    streak: newStreak,
    lastActiveDate: today,
    totalAnswered: stats.totalAnswered + answeredCount,
    totalCorrect: stats.totalCorrect + correctCount,
  };

  await saveUserStats(updated);
  return updated;
}

export async function deleteAttempt(id: string): Promise<void> {
  await db.attempts.delete(id);
}

export async function getAllBookmarks(): Promise<Bookmark[]> {
  return await db.bookmarks.orderBy("dateAdded").reverse().toArray();
}

export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  await db.bookmarks.put(bookmark);
}

export async function removeBookmark(id: string): Promise<void> {
  await db.bookmarks.delete(id);
}

export async function updateBookmarkNote(id: string, note: string): Promise<void> {
  const existing = await db.bookmarks.get(id);
  if (existing) {
    await db.bookmarks.put({ ...existing, note });
  }
}

export async function getMasteredMistakes(): Promise<Record<string, boolean>> {
  const entry = await db.keyValSettings.get("mastered_mistakes");
  return entry ? (entry.value as Record<string, boolean>) : {};
}

export async function saveMasteredMistake(questionKey: string, mastered: boolean): Promise<void> {
  const current = await getMasteredMistakes();
  current[questionKey] = mastered;
  await db.keyValSettings.put({ key: "mastered_mistakes", value: current });
}

export async function getMistakeNotes(): Promise<Record<string, string>> {
  const entry = await db.keyValSettings.get("mistake_notes");
  return entry ? (entry.value as Record<string, string>) : {};
}

export async function saveMistakeNote(questionKey: string, note: string): Promise<void> {
  const current = await getMistakeNotes();
  current[questionKey] = note;
  await db.keyValSettings.put({ key: "mistake_notes", value: current });
}

export interface RecordAnswerParams {
  qkey: string;
  result: "correct" | "wrong" | "skipped";
  timeMs?: number;
}

/**
 * Record an answer result for a question identified by its stable qkey.
 * Works across all modes: mock exams, section tests, practice/learn, and sprint.
 */
export async function recordAnswer(params: RecordAnswerParams): Promise<void> {
  const { qkey, result, timeMs = 0 } = params;
  if (!qkey) return;

  const existing = await db.questionStats.get(qkey);
  const now = new Date().toISOString();

  if (existing) {
    await db.questionStats.put({
      qkey,
      attempts: existing.attempts + 1,
      correct: existing.correct + (result === "correct" ? 1 : 0),
      wrong: existing.wrong + (result === "wrong" ? 1 : 0),
      skipped: existing.skipped + (result === "skipped" ? 1 : 0),
      lastAnsweredAt: now,
      lastResult: result,
      totalTimeMs: (existing.totalTimeMs || 0) + timeMs,
    });
  } else {
    await db.questionStats.put({
      qkey,
      attempts: 1,
      correct: result === "correct" ? 1 : 0,
      wrong: result === "wrong" ? 1 : 0,
      skipped: result === "skipped" ? 1 : 0,
      lastAnsweredAt: now,
      lastResult: result,
      totalTimeMs: timeMs,
    });
  }
}

/**
 * Get all recorded question stats indexed by qkey.
 */
export async function getAllQuestionStats(): Promise<Record<string, QuestionStat>> {
  const statsList = await db.questionStats.toArray();
  const map: Record<string, QuestionStat> = {};
  for (const s of statsList) {
    map[s.qkey] = s;
  }
  return map;
}

/**
 * Backfill questionStats from existing test attempts if not already performed.
 */
export async function backfillQuestionStatsFromAttempts(
  testResolver?: (testId: string) => Promise<ExamTest | null>
): Promise<void> {
  const backfilled = await db.keyValSettings.get("question_stats_backfilled");
  if (backfilled?.value) return;

  const attempts = await db.attempts.toArray();
  if (attempts.length === 0) {
    await db.keyValSettings.put({ key: "question_stats_backfilled", value: true });
    return;
  }

  for (const att of attempts) {
    if (!att.testId || !att.userAnswers) continue;
    let testData: ExamTest | null = null;
    if (testResolver) {
      testData = await testResolver(att.testId);
    } else {
      try {
        const res = await fetch(`./data/tests/${att.testId}.json`);
        if (res.ok) {
          testData = await res.json();
        }
      } catch {
        // Skip if fetch fails during headless test
      }
    }

    if (!testData || !testData.questions) continue;

    for (const q of testData.questions) {
      if (!q.qkey) continue;
      const userAns = att.userAnswers[q.n];
      const timeSec = att.timeSpentPerQuestion?.[q.n] || 0;
      let result: "correct" | "wrong" | "skipped" = "skipped";
      if (userAns !== undefined && userAns !== null) {
        result = userAns === q.answer ? "correct" : "wrong";
      }

      await recordAnswer({
        qkey: q.qkey,
        result,
        timeMs: timeSec * 1000,
      });
    }
  }

  await db.keyValSettings.put({ key: "question_stats_backfilled", value: true });
}


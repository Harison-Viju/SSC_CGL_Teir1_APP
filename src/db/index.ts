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
} from "../types";

export class ExamQuestDatabase extends Dexie {
  attempts!: Table<TestAttemptSummary, string>;
  bookmarks!: Table<Bookmark, string>;
  flags!: Table<QuestionFlag, string>;
  inProgress!: Table<InProgressAttempt, string>;
  stats!: Table<UserStats & { id: string }, string>;
  keyValSettings!: Table<{ key: string; value: any }, string>;

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
  }
}

export const db = new ExamQuestDatabase();

export async function getUserStats(): Promise<UserStats> {
  const existing = await db.stats.get("user_stats");
  if (existing) {
    return existing;
  }
  const initial: UserStats = {
    xp: 150,
    streak: 3,
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


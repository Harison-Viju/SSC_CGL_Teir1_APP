/**
 * Loader utility for cross-paper questions, topics catalog, and stats map.
 * Caches loaded tests in memory for instant topic browsing and drill launching.
 */

import type { Question, TopicMeta, QuestionStat, TestManifest, ExamTest } from "../types";
import { getAllQuestionStats } from "../db";

let cachedTopics: TopicMeta[] | null = null;
let cachedQuestions: Question[] | null = null;

export async function fetchAllTopics(): Promise<TopicMeta[]> {
  if (cachedTopics) return cachedTopics;
  try {
    const res = await fetch("./data/topics.json");
    if (!res.ok) throw new Error(`Failed to load topics: ${res.statusText}`);
    const data: TopicMeta[] = await res.json();
    cachedTopics = data;
    return data;
  } catch (err) {
    console.error("Failed to load topics.json:", err);
    return [];
  }
}

export async function fetchAllQuestions(): Promise<Question[]> {
  if (cachedQuestions) return cachedQuestions;
  try {
    const manifestRes = await fetch("./data/manifest.json");
    if (!manifestRes.ok) throw new Error("Failed to load manifest");
    const manifest: TestManifest = await manifestRes.json();

    const testPromises = manifest.tests.map(async (t) => {
      try {
        const testRes = await fetch(`./data/tests/${t.id}.json`);
        if (!testRes.ok) return [];
        const testData: ExamTest = await testRes.json();
        return testData.questions.map((q) => ({
          ...q,
          // Guarantee testId is tracked for bookmarks/passages
          testId: t.id,
        }));
      } catch (e) {
        console.error(`Failed to load test ${t.id}:`, e);
        return [];
      }
    });

    const results = await Promise.all(testPromises);
    const flattened = results.flat();
    cachedQuestions = flattened;
    return flattened;
  } catch (err) {
    console.error("Failed to load all questions:", err);
    return [];
  }
}

export async function getStatsMap(): Promise<Record<string, QuestionStat>> {
  return getAllQuestionStats();
}

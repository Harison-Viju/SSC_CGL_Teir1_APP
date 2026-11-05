/**
 * Topic Statistics and Question Selection Selectors.
 * Pure functions for topic mastery computation and quality-filtered question selection.
 */

import type { Question, QuestionStat, TopicStatsResult } from "../types";

export interface PickQuestionsOptions {
  topicIds?: string[] | string;
  topicId?: string;
  count?: number;
  includeFigures?: boolean;
  includePassages?: boolean;
  filter?: "all" | "unseen" | "wrong" | "bookmarked";
  flaggedKeys?: Set<string> | string[];
  bookmarkedKeys?: Set<string> | string[];
  questions?: Question[];
  statsMap?: Record<string, QuestionStat>;
  rng?: () => number;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-");
}

export const FIGURE_TOPIC_SLUGS = new Set([
  "figure-series",
  "mirror-water-image",
  "paper-folding-cutting",
  "cube-dice",
  "embedded-figures",
  "counting-figures",
]);

/**
 * Pure selector computing topic mastery statistics.
 *
 * Mastery levels:
 * - 0: not started (0 attempted)
 * - 1: under 50% accuracy
 * - 2: from 50% to 79% (or >= 80% with fewer than 10 attempted)
 * - 3: 80%+ accuracy with at least 10 attempted
 */
export function getTopicStats(
  topicId: string,
  questions: Question[] = [],
  statsMap: Record<string, QuestionStat> = {}
): TopicStatsResult {
  const targetSlug = slugify(topicId);
  const targetNorm = topicId.trim().toLowerCase();

  // Filter questions belonging to this topic
  const matchingQuestions = questions.filter((q) => {
    if (!q.topic) return false;
    return (
      slugify(q.topic) === targetSlug ||
      q.topic.trim().toLowerCase() === targetNorm
    );
  });

  // De-duplicate by qkey
  const uniqueQuestionsMap = new Map<string, Question>();
  for (const q of matchingQuestions) {
    const key = q.qkey || `${q.section}:${q.n}`;
    if (!uniqueQuestionsMap.has(key)) {
      uniqueQuestionsMap.set(key, q);
    }
  }

  const uniqueQuestions = Array.from(uniqueQuestionsMap.values());
  const total = uniqueQuestions.length;

  if (total === 0) {
    return {
      total: 0,
      attempted: 0,
      accuracy: 0,
      masteryLevel: 0,
    };
  }

  let attemptedCount = 0;
  let totalCorrect = 0;
  let totalWrong = 0;

  for (const q of uniqueQuestions) {
    const key = q.qkey || `${q.section}:${q.n}`;
    const stat = statsMap[key];
    if (stat && (stat.attempts > 0 || stat.lastResult)) {
      attemptedCount += 1;
      totalCorrect += stat.correct || 0;
      totalWrong += stat.wrong || 0;
    }
  }

  const totalEvaluated = totalCorrect + totalWrong;
  const accuracy =
    totalEvaluated > 0
      ? Math.round((totalCorrect / totalEvaluated) * 100)
      : 0;

  let masteryLevel: 0 | 1 | 2 | 3 = 0;
  if (attemptedCount === 0) {
    masteryLevel = 0;
  } else if (accuracy < 50) {
    masteryLevel = 1;
  } else if (accuracy >= 80 && attemptedCount >= 10) {
    masteryLevel = 3;
  } else {
    // 50% to 79%, or >= 80% with < 10 attempted
    masteryLevel = 2;
  }

  return {
    total,
    attempted: attemptedCount,
    accuracy,
    masteryLevel,
  };
}

/**
 * Standard Fisher-Yates array shuffle using provided RNG.
 */
function shuffle<T>(array: T[], rng: () => number = Math.random): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Pure selector picking questions according to quality, priority, and filters.
 *
 * Rules:
 * - Quality filter: confidence >= 0.9, no warnings, not flagged by user
 * - Default: not passage-based unless includePassages: true
 * - Figures: excluded by default unless includeFigures: true or topic is a figure topic
 * - De-duplicated by qkey (no repeats)
 * - Priority: never seen > wrong last time > correct last time
 * - Shuffled inside each priority group
 * - Returns fewer if pool is smaller (never fabricates questions)
 */
export function pickQuestions(options: PickQuestionsOptions = {}): Question[] {
  const {
    topicIds,
    topicId,
    count,
    includeFigures,
    includePassages = false,
    filter = "all",
    flaggedKeys,
    bookmarkedKeys,
    questions = [],
    statsMap = {},
    rng = Math.random,
  } = options;

  // Normalize topics filter
  const rawTopics = topicIds
    ? Array.isArray(topicIds)
      ? topicIds
      : [topicIds]
    : topicId
    ? [topicId]
    : [];

  const targetTopicSlugs = new Set(rawTopics.map((t) => slugify(t)));
  const hasFigureTopic = rawTopics.some((t) =>
    FIGURE_TOPIC_SLUGS.has(slugify(t))
  );

  // Normalize flagged keys set
  const flaggedSet = new Set(
    flaggedKeys
      ? flaggedKeys instanceof Set
        ? Array.from(flaggedKeys)
        : flaggedKeys
      : []
  );

  // Normalize bookmarked keys set
  const bookmarkedSet = new Set(
    bookmarkedKeys
      ? bookmarkedKeys instanceof Set
        ? Array.from(bookmarkedKeys)
        : bookmarkedKeys
      : []
  );

  // Should we allow figure questions?
  const allowFigures = includeFigures !== undefined ? includeFigures : hasFigureTopic;

  // Step 1: Filter eligible questions and de-duplicate by qkey
  const seenQkeys = new Set<string>();
  const candidates: Question[] = [];

  for (const q of questions) {
    const key = q.qkey || `${q.section}:${q.n}`;

    // De-duplication check: no duplicate qkeys
    if (seenQkeys.has(key)) {
      continue;
    }

    // Topic match (if specific topic requested)
    if (targetTopicSlugs.size > 0) {
      const qSlug = slugify(q.topic || "");
      if (!targetTopicSlugs.has(qSlug)) {
        continue;
      }
    }

    // Quality Filter: confidence >= 0.9, no warnings, not flagged
    const conf = q.confidence ?? 1.0;
    if (conf < 0.9) {
      continue;
    }

    if (q.warnings && q.warnings.length > 0) {
      continue;
    }

    if (flaggedSet.has(key)) {
      continue;
    }

    // Passage filter: by default not passage-based
    if (!includePassages && q.passage_id) {
      continue;
    }

    // Figure filter: exclude figures if not allowed
    const isFigure =
      q.render_mode !== "text" || !!q.stem_image || !!q.full_image;
    if (isFigure && !allowFigures) {
      continue;
    }

    const stat = statsMap[key];

    // Filter modes
    if (filter === "unseen") {
      if (stat && stat.attempts > 0) {
        continue;
      }
    } else if (filter === "wrong") {
      const hadWrong = stat && (stat.wrong > 0 || stat.lastResult === "wrong");
      if (!hadWrong) {
        continue;
      }
    } else if (filter === "bookmarked") {
      if (!bookmarkedSet.has(key)) {
        continue;
      }
    }

    seenQkeys.add(key);
    candidates.push(q);
  }

  // Step 2: Segregate candidates into 3 priority groups:
  // Priority 1: never seen
  // Priority 2: wrong last time
  // Priority 3: seen correct (or other)
  const group1NeverSeen: Question[] = [];
  const group2WrongLast: Question[] = [];
  const group3CorrectLast: Question[] = [];

  for (const q of candidates) {
    const key = q.qkey || `${q.section}:${q.n}`;
    const stat = statsMap[key];

    if (!stat || stat.attempts === 0) {
      group1NeverSeen.push(q);
    } else if (stat.lastResult === "wrong") {
      group2WrongLast.push(q);
    } else {
      // "correct" or "skipped" last time
      group3CorrectLast.push(q);
    }
  }

  // Step 3: Shuffle inside each group
  const shuffledG1 = shuffle(group1NeverSeen, rng);
  const shuffledG2 = shuffle(group2WrongLast, rng);
  const shuffledG3 = shuffle(group3CorrectLast, rng);

  // Concatenate in strict priority order
  const ordered = [...shuffledG1, ...shuffledG2, ...shuffledG3];

  // Step 4: Return count or all available without repeats
  if (count !== undefined && count > 0) {
    return ordered.slice(0, count);
  }

  return ordered;
}

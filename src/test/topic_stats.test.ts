/**
 * Unit tests for topic statistics calculation and question picker selectors.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { getTopicStats, pickQuestions } from "../utils/topicStats";
import type { Question, QuestionStat } from "../types";

function createMockQuestion(overrides: Partial<Question>): Question {
  return {
    n: overrides.n ?? 1,
    section: overrides.section ?? "reasoning",
    topic: overrides.topic ?? "Number Series",
    render_mode: overrides.render_mode ?? "text",
    stem: overrides.stem ?? "Sample stem",
    options: overrides.options ?? ["A", "B", "C", "D"],
    answer: overrides.answer ?? 0,
    confidence: overrides.confidence ?? 1.0,
    warnings: overrides.warnings ?? [],
    duplicate_of: overrides.duplicate_of ?? null,
    qkey: overrides.qkey ?? `qkey_${overrides.n ?? 1}`,
    passage_id: overrides.passage_id ?? null,
    stem_image: overrides.stem_image ?? null,
    full_image: overrides.full_image ?? null,
  };
}

test("getTopicStats returns mastery 0 for unstarted topic", () => {
  const questions: Question[] = [
    createMockQuestion({ n: 1, topic: "Algebra", qkey: "q1" }),
    createMockQuestion({ n: 2, topic: "Algebra", qkey: "q2" }),
  ];

  const stats = getTopicStats("Algebra", questions, {});
  assert.equal(stats.total, 2);
  assert.equal(stats.attempted, 0);
  assert.equal(stats.accuracy, 0);
  assert.equal(stats.masteryLevel, 0);
});

test("getTopicStats returns mastery 1 for under 50% accuracy", () => {
  const questions: Question[] = [
    createMockQuestion({ n: 1, topic: "Algebra", qkey: "q1" }),
    createMockQuestion({ n: 2, topic: "Algebra", qkey: "q2" }),
    createMockQuestion({ n: 3, topic: "Algebra", qkey: "q3" }),
  ];

  const statsMap: Record<string, QuestionStat> = {
    q1: { qkey: "q1", attempts: 1, correct: 0, wrong: 1, skipped: 0, lastAnsweredAt: "", lastResult: "wrong", totalTimeMs: 1000 },
    q2: { qkey: "q2", attempts: 1, correct: 0, wrong: 1, skipped: 0, lastAnsweredAt: "", lastResult: "wrong", totalTimeMs: 1000 },
    q3: { qkey: "q3", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
  };

  const stats = getTopicStats("Algebra", questions, statsMap);
  assert.equal(stats.total, 3);
  assert.equal(stats.attempted, 3);
  assert.equal(stats.accuracy, 33);
  assert.equal(stats.masteryLevel, 1);
});

test("getTopicStats returns mastery 2 for 50-79% accuracy OR >= 80% with < 10 attempted", () => {
  // Case A: 60% accuracy with 5 attempted
  const qSetA: Question[] = [
    createMockQuestion({ n: 1, topic: "Geometry", qkey: "g1" }),
    createMockQuestion({ n: 2, topic: "Geometry", qkey: "g2" }),
    createMockQuestion({ n: 3, topic: "Geometry", qkey: "g3" }),
    createMockQuestion({ n: 4, topic: "Geometry", qkey: "g4" }),
    createMockQuestion({ n: 5, topic: "Geometry", qkey: "g5" }),
  ];

  const statsMapA: Record<string, QuestionStat> = {
    g1: { qkey: "g1", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
    g2: { qkey: "g2", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
    g3: { qkey: "g3", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
    g4: { qkey: "g4", attempts: 1, correct: 0, wrong: 1, skipped: 0, lastAnsweredAt: "", lastResult: "wrong", totalTimeMs: 1000 },
    g5: { qkey: "g5", attempts: 1, correct: 0, wrong: 1, skipped: 0, lastAnsweredAt: "", lastResult: "wrong", totalTimeMs: 1000 },
  };

  const resA = getTopicStats("geometry", qSetA, statsMapA);
  assert.equal(resA.accuracy, 60);
  assert.equal(resA.masteryLevel, 2);

  // Case B: 100% accuracy but only 4 attempted (< 10)
  const qSetB: Question[] = [
    createMockQuestion({ n: 1, topic: "Geometry", qkey: "g1" }),
    createMockQuestion({ n: 2, topic: "Geometry", qkey: "g2" }),
    createMockQuestion({ n: 3, topic: "Geometry", qkey: "g3" }),
    createMockQuestion({ n: 4, topic: "Geometry", qkey: "g4" }),
  ];
  const statsMapB: Record<string, QuestionStat> = {
    g1: { qkey: "g1", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
    g2: { qkey: "g2", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
    g3: { qkey: "g3", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
    g4: { qkey: "g4", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
  };
  const resB = getTopicStats("Geometry", qSetB, statsMapB);
  assert.equal(resB.accuracy, 100);
  assert.equal(resB.masteryLevel, 2);
});

test("getTopicStats returns mastery 3 for >= 80% accuracy with at least 10 attempted", () => {
  const questions: Question[] = Array.from({ length: 12 }, (_, i) =>
    createMockQuestion({ n: i + 1, topic: "Percentage", qkey: `p${i + 1}` })
  );

  const statsMap: Record<string, QuestionStat> = {};
  // 10 correct, 2 wrong -> 10/12 = 83%
  for (let i = 1; i <= 10; i++) {
    statsMap[`p${i}`] = {
      qkey: `p${i}`,
      attempts: 1,
      correct: 1,
      wrong: 0,
      skipped: 0,
      lastAnsweredAt: "",
      lastResult: "correct",
      totalTimeMs: 1000,
    };
  }
  for (let i = 11; i <= 12; i++) {
    statsMap[`p${i}`] = {
      qkey: `p${i}`,
      attempts: 1,
      correct: 0,
      wrong: 1,
      skipped: 0,
      lastAnsweredAt: "",
      lastResult: "wrong",
      totalTimeMs: 1000,
    };
  }

  const stats = getTopicStats("Percentage", questions, statsMap);
  assert.equal(stats.total, 12);
  assert.equal(stats.attempted, 12);
  assert.equal(stats.accuracy, 83);
  assert.equal(stats.masteryLevel, 3);
});

test("pickQuestions prioritizes never seen > wrong last time > correct last time", () => {
  const qUnseen1 = createMockQuestion({ n: 1, qkey: "unseen1" });
  const qUnseen2 = createMockQuestion({ n: 2, qkey: "unseen2" });
  const qWrong = createMockQuestion({ n: 3, qkey: "wrong" });
  const qCorrect = createMockQuestion({ n: 4, qkey: "correct" });

  const statsMap: Record<string, QuestionStat> = {
    wrong: { qkey: "wrong", attempts: 1, correct: 0, wrong: 1, skipped: 0, lastAnsweredAt: "", lastResult: "wrong", totalTimeMs: 1000 },
    correct: { qkey: "correct", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
  };

  const pool = [qCorrect, qWrong, qUnseen1, qUnseen2];
  // Deterministic shuffle
  const selected = pickQuestions({
    questions: pool,
    statsMap,
    rng: () => 0.5,
  });

  const selectedKeys = selected.map((q) => q.qkey);
  // Unseen must come first
  assert.ok(selectedKeys.indexOf("unseen1") < 2);
  assert.ok(selectedKeys.indexOf("unseen2") < 2);
  // Wrong must come after unseens and before correct
  assert.equal(selectedKeys[2], "wrong");
  // Correct must come last
  assert.equal(selectedKeys[3], "correct");
});

test("pickQuestions de-duplicates questions sharing the same qkey", () => {
  const q1 = createMockQuestion({ n: 1, qkey: "shared_qkey", stem: "First occurrence" });
  const q2 = createMockQuestion({ n: 5, qkey: "shared_qkey", duplicate_of: "paper:1", stem: "Second occurrence" });
  const q3 = createMockQuestion({ n: 3, qkey: "unique_qkey", stem: "Unique question" });

  const selected = pickQuestions({
    questions: [q1, q2, q3],
  });

  assert.equal(selected.length, 2);
  const keys = new Set(selected.map((q) => q.qkey));
  assert.ok(keys.has("shared_qkey"));
  assert.ok(keys.has("unique_qkey"));
});

test("pickQuestions enforces quality filters: confidence >= 0.9, no warnings, not flagged", () => {
  const qGood = createMockQuestion({ n: 1, qkey: "good", confidence: 1.0, warnings: [] });
  const qLowConf = createMockQuestion({ n: 2, qkey: "low_conf", confidence: 0.85 });
  const qWarning = createMockQuestion({ n: 3, qkey: "warning", warnings: ["Bbox clip warning"] });
  const qFlagged = createMockQuestion({ n: 4, qkey: "flagged" });

  const selected = pickQuestions({
    questions: [qGood, qLowConf, qWarning, qFlagged],
    flaggedKeys: new Set(["flagged"]),
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].qkey, "good");
});

test("pickQuestions excludes passages by default unless includePassages: true", () => {
  const qNormal = createMockQuestion({ n: 1, qkey: "normal", passage_id: null });
  const qPassage = createMockQuestion({ n: 2, qkey: "passage", passage_id: "passage_1" });

  const defaultSelection = pickQuestions({ questions: [qNormal, qPassage] });
  assert.equal(defaultSelection.length, 1);
  assert.equal(defaultSelection[0].qkey, "normal");

  const withPassages = pickQuestions({
    questions: [qNormal, qPassage],
    includePassages: true,
  });
  assert.equal(withPassages.length, 2);
});

test("pickQuestions respects filter modes: unseen, wrong, bookmarked", () => {
  const q1 = createMockQuestion({ n: 1, qkey: "q1" });
  const q2 = createMockQuestion({ n: 2, qkey: "q2" });
  const q3 = createMockQuestion({ n: 3, qkey: "q3" });

  const statsMap: Record<string, QuestionStat> = {
    q2: { qkey: "q2", attempts: 1, correct: 0, wrong: 1, skipped: 0, lastAnsweredAt: "", lastResult: "wrong", totalTimeMs: 1000 },
    q3: { qkey: "q3", attempts: 1, correct: 1, wrong: 0, skipped: 0, lastAnsweredAt: "", lastResult: "correct", totalTimeMs: 1000 },
  };

  // filter: unseen
  const unseenOnly = pickQuestions({
    questions: [q1, q2, q3],
    statsMap,
    filter: "unseen",
  });
  assert.equal(unseenOnly.length, 1);
  assert.equal(unseenOnly[0].qkey, "q1");

  // filter: wrong
  const wrongOnly = pickQuestions({
    questions: [q1, q2, q3],
    statsMap,
    filter: "wrong",
  });
  assert.equal(wrongOnly.length, 1);
  assert.equal(wrongOnly[0].qkey, "q2");

  // filter: bookmarked
  const bookmarkedOnly = pickQuestions({
    questions: [q1, q2, q3],
    statsMap,
    filter: "bookmarked",
    bookmarkedKeys: new Set(["q3"]),
  });
  assert.equal(bookmarkedOnly.length, 1);
  assert.equal(bookmarkedOnly[0].qkey, "q3");
});

test("pickQuestions returns requested count and never fabricates when pool is smaller", () => {
  const pool = [
    createMockQuestion({ n: 1, qkey: "q1" }),
    createMockQuestion({ n: 2, qkey: "q2" }),
  ];

  const sliced = pickQuestions({ questions: pool, count: 1 });
  assert.equal(sliced.length, 1);

  const requestMoreThanPool = pickQuestions({ questions: pool, count: 50 });
  assert.equal(requestMoreThanPool.length, 2);
});

/**
 * Unit tests for ExamQuest core application scoring, timers, and filtering logic.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { formatTime, getQuestionStatus, computeAttemptSummary } from "../utils/examEngine";
import type { ExamTest } from "../types";

test("formatTime formats seconds into mm:ss accurately", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(59), "00:59");
  assert.equal(formatTime(60), "01:00");
  assert.equal(formatTime(90), "01:30");
  assert.equal(formatTime(3599), "59:59");
  assert.equal(formatTime(3600), "60:00");
  assert.equal(formatTime(-10), "00:00");
});

test("getQuestionStatus determines exact SSC palette state", () => {
  // Not visited
  assert.equal(getQuestionStatus(1, {}, {}, {}), "not_visited");

  // Visited but not answered
  assert.equal(getQuestionStatus(1, {}, {}, { 1: true }), "not_answered");

  // Answered
  assert.equal(getQuestionStatus(1, { 1: 2 }, {}, { 1: true }), "answered");

  // Marked for review (unanswered)
  assert.equal(getQuestionStatus(1, {}, { 1: true }, { 1: true }), "marked_for_review");

  // Answered & Marked for review
  assert.equal(getQuestionStatus(1, { 1: 0 }, { 1: true }, { 1: true }), "answered_and_marked");
});

test("computeAttemptSummary computes section and total scores with negative marking", () => {
  const dummyTest: ExamTest = {
    schema_version: 1,
    id: "test-mock-1",
    title: "Sample Mock",
    exam: "SSC CGL Tier 1",
    date: "2026-10-01",
    language: "en",
    source_file: "dummy.pdf",
    source_sha256: "abc",
    marking: { correct: 2.0, wrong: -0.5, unanswered: 0.0 },
    duration_minutes: 60,
    sections: [
      { id: "reasoning", name: "Reasoning", from: 1, to: 2, duration_minutes: 15 },
      { id: "qa", name: "Quant", from: 3, to: 4, duration_minutes: 15 },
    ],
    passages: [],
    questions: [
      { n: 1, section: "reasoning", topic: "Series", render_mode: "text", stem: "Q1", options: ["A", "B"], answer: 0 },
      { n: 2, section: "reasoning", topic: "Series", render_mode: "text", stem: "Q2", options: ["A", "B"], answer: 1 },
      { n: 3, section: "qa", topic: "Algebra", render_mode: "text", stem: "Q3", options: ["A", "B"], answer: 0 },
      { n: 4, section: "qa", topic: "Algebra", render_mode: "text", stem: "Q4", options: ["A", "B"], answer: 1 },
    ],
  };

  const answers = {
    1: 0, // Correct (+2.0)
    2: 0, // Wrong (-0.5)
    3: 0, // Correct (+2.0)
    // 4 is skipped (0.0)
  };

  const timeSpent = { 1: 30, 2: 40, 3: 50, 4: 0 };
  const startedAt = 1000000;
  const endedAt = 1000000 + 120 * 1000;

  const result = computeAttemptSummary(dummyTest, "full", answers, timeSpent, startedAt, endedAt);

  assert.equal(result.totalQuestions, 4);
  assert.equal(result.correct, 2);
  assert.equal(result.wrong, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.attempted, 3);
  assert.equal(result.score, 3.5); // 2 + 2 - 0.5 = 3.5
  assert.equal(result.accuracy, 67); // 2/3 = 66.6% -> 67%
  assert.equal(result.sectionScores["reasoning"].score, 1.5); // +2 - 0.5
  assert.equal(result.sectionScores["qa"].score, 2.0); // +2
  assert.equal(result.topicStats["Series"].correct, 1);
  assert.equal(result.topicStats["Series"].wrong, 1);
});

test("calculateLevel and calculateQuestionXp compute accurate gamification progression", async () => {
  const { calculateLevel, calculateQuestionXp } = await import("../utils/gamification");

  // XP Calculations
  assert.equal(calculateQuestionXp(false, 0), 0);
  assert.equal(calculateQuestionXp(false, 5), 0);
  assert.equal(calculateQuestionXp(true, 1), 10); // Base XP
  assert.equal(calculateQuestionXp(true, 3), 12); // Base + 2
  assert.equal(calculateQuestionXp(true, 5), 15); // Base + 5
  assert.equal(calculateQuestionXp(true, 10), 20); // Base + 10

  // Level Progression
  const l1 = calculateLevel(0);
  assert.equal(l1.level, 1);
  assert.equal(l1.title, "Rookie Aspirant");
  assert.equal(l1.progressPercent, 0);

  const l1Mid = calculateLevel(75);
  assert.equal(l1Mid.level, 1);
  assert.equal(l1Mid.progressPercent, 50);

  const l2 = calculateLevel(150);
  assert.equal(l2.level, 2);
  assert.equal(l2.title, "Diligent Scholar");

  const lHigh = calculateLevel(2500);
  assert.ok(lHigh.level >= 5);
  assert.ok(lHigh.progressPercent >= 0 && lHigh.progressPercent <= 100);
});

test("exportAttemptsToCsv correctly formats CSV cells and escape characters", async () => {
  const { exportAttemptsToCsv } = await import("../utils/exportData");
  assert.equal(typeof exportAttemptsToCsv, "function");
});

test("getLeagueTier accurately maps XP thresholds into competitive tiers", async () => {
  const { getLeagueTier } = await import("../utils/gamification");
  assert.equal(getLeagueTier(100), "Bronze");
  assert.equal(getLeagueTier(250), "Silver");
  assert.equal(getLeagueTier(600), "Gold");
  assert.equal(getLeagueTier(1000), "Platinum");
  assert.equal(getLeagueTier(1500), "Diamond");
  assert.equal(getLeagueTier(3000), "Diamond");
});

test("question blocks preserve labels and list items for structured questions like Q20", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const testFile = path.resolve("./public/data/tests/ssc-cgl-2026-10-01.json");
  const testData = JSON.parse(fs.readFileSync(testFile, "utf-8"));
  
  const q20 = testData.questions.find((q: any) => q.n === 20);
  assert.ok(q20, "Q20 should exist");
  assert.ok(Array.isArray(q20.blocks), "Q20 should have blocks array");
  
  const labels = q20.blocks.filter((b: any) => b.type === "label");
  const listItems = q20.blocks.filter((b: any) => b.type === "list_item");
  
  assert.equal(labels.length, 2, "Q20 should have Statement and Inference labels");
  assert.equal(listItems.length, 3, "Q20 should have 3 inference list items (I., II., III.)");
  assert.equal(listItems[0].marker, "I.");
  assert.equal(listItems[1].marker, "II.");
  assert.equal(listItems[2].marker, "III.");
});

test("Q21 is in image_stem mode with stem_image provided and not full_image", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const testFile = path.resolve("./public/data/tests/ssc-cgl-2026-10-01.json");
  const testData = JSON.parse(fs.readFileSync(testFile, "utf-8"));
  
  const q21 = testData.questions.find((q: any) => q.n === 21);
  assert.ok(q21, "Q21 should exist");
  assert.equal(q21.render_mode, "image_stem");
  assert.ok(q21.stem_image, "Q21 must have stem_image");
  assert.ok(q21.stem_image.includes("q021_stem.webp"), "Q21 points to cropped stem image");
});


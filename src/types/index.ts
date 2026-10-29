/**
 * Core type definitions for ExamQuest.
 */

export type RenderMode = "text" | "image_stem" | "image_full";

export interface MarkingScheme {
  correct: number;
  wrong: number;
  unanswered: number;
}

export interface SectionDef {
  id: string;
  name: string;
  from: number;
  to: number;
  duration_minutes: number;
}

export interface Passage {
  id: string;
  range: [number, number];
  text: string;
}

export type QuestionBlockType = "paragraph" | "label" | "list_item";

export interface QuestionBlock {
  type: QuestionBlockType;
  marker?: string;
  text: string;
}

export interface Question {
  n: number;
  section: string;
  topic: string;
  render_mode: RenderMode;
  stem: string;
  blocks?: QuestionBlock[];
  stem_image?: string | null;
  full_image?: string | null;
  options: string[];
  raw_options?: string[];
  answer: number; // 0..3 (A..D)
  passage_id?: string | null;
  confidence?: number;
  warnings?: string[];
  duplicate_of?: string | null;
}

export interface ExamTest {
  schema_version: number;
  id: string;
  title: string;
  exam: string;
  date: string;
  shift?: number | null;
  language: string;
  source_file: string;
  source_sha256: string;
  marking: MarkingScheme;
  duration_minutes: number;
  sections: SectionDef[];
  passages: Passage[];
  questions: Question[];
}

export interface TestManifestEntry {
  id: string;
  title: string;
  exam: string;
  date: string;
  shift?: number | null;
  duration_minutes: number;
  total_questions: number;
  marking: MarkingScheme;
  sections: {
    id: string;
    name: string;
    count: number;
    duration_minutes: number;
  }[];
  render_mode_counts: {
    text: number;
    image_stem: number;
    image_full: number;
  };
  passed: boolean;
  source_file: string;
}

export interface TestManifest {
  tests: TestManifestEntry[];
  updated_at: string;
}

export type ExamMode = "full" | "section" | "practice" | "mistake_review";

export type PaletteStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked_for_review"
  | "answered_and_marked";

export interface InProgressAttempt {
  id: string;
  testId: string;
  mode: ExamMode;
  selectedSectionId?: string;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  answers: Record<number, number>; // qNum -> chosenOption index (0..3)
  markedForReview: Record<number, boolean>;
  timeSpentPerQuestion: Record<number, number>; // qNum -> seconds
  remainingSeconds: number;
  sectionRemainingSeconds: Record<string, number>;
  startedAt: number;
  lastUpdated: number;
}

export interface TestAttemptSummary {
  id: string;
  testId: string;
  testTitle: string;
  mode: ExamMode;
  date: string;
  timestamp: number;
  score: number;
  maxScore: number;
  accuracy: number;
  timeSpentSeconds: number;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  sectionScores: Record<
    string,
    {
      score: number;
      maxScore: number;
      correct: number;
      wrong: number;
      skipped: number;
      timeSpentSeconds: number;
    }
  >;
  topicStats: Record<
    string,
    {
      total: number;
      correct: number;
      wrong: number;
    }
  >;
  userAnswers: Record<number, number>; // qNum -> chosen index
  timeSpentPerQuestion: Record<number, number>;
}

export interface Bookmark {
  id: string;
  testId: string;
  qNum: number;
  topic: string;
  dateAdded: number;
  note?: string;
}

export interface QuestionFlag {
  id: string;
  testId: string;
  qNum: number;
  reason: string;
  details?: string;
  dateAdded: number;
}

export interface UserStats {
  xp: number;
  streak: number;
  lastActiveDate: string;
  completedTestsCount: number;
  totalAnswered: number;
  totalCorrect: number;
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  soundEnabled: boolean;
  reducedMotion: boolean;
  strictSections: boolean;
  defaultMockDuration: number;
}

export type LeagueTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export interface StudentBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface LeaderboardEntry {
  id: string;
  rank?: number;
  name: string;
  avatarBg: string;
  initials: string;
  location: string;
  targetPost: string;
  xp: number;
  weeklyXp: number;
  mockScore: number;
  maxScore: number;
  streak: number;
  tier: LeagueTier;
  accuracy: number;
  testsCompleted: number;
  rankDelta?: number;
  isCurrentUser?: boolean;
  badges: string[];
  breakdown: {
    reasoning: number;
    ga: number;
    quants: number;
    english: number;
  };
}

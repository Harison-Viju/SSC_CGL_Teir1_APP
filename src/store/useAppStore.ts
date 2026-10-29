/**
 * Global Zustand store for ExamQuest application state.
 */

import { create } from "zustand";
import type {
  TestManifest,
  ExamTest,
  UserStats,
  UserSettings,
  InProgressAttempt,
} from "../types";
import {
  getUserStats,
  getAllInProgressAttempts,
  saveInProgressAttempt,
  clearInProgressAttempt,
  recordPracticeSession,
} from "../db";

interface AppState {
  manifest: TestManifest | null;
  loadingManifest: boolean;
  manifestError: string | null;

  activeTest: ExamTest | null;
  loadingTest: boolean;
  testError: string | null;

  userStats: UserStats;
  settings: UserSettings;
  inProgressAttempts: InProgressAttempt[];

  // Actions
  fetchManifest: () => Promise<void>;
  fetchTest: (testId: string) => Promise<ExamTest | null>;
  refreshStats: () => Promise<void>;
  refreshInProgress: () => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  removeInProgress: (testId: string) => Promise<void>;
  addPracticeStats: (earnedXp: number, answered: number, correct: number) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  manifest: null,
  loadingManifest: false,
  manifestError: null,

  activeTest: null,
  loadingTest: false,
  testError: null,

  userStats: {
    xp: 0,
    streak: 1,
    lastActiveDate: new Date().toISOString().split("T")[0],
    completedTestsCount: 0,
    totalAnswered: 0,
    totalCorrect: 0,
  },

  settings: {
    theme: (localStorage.getItem("examquest_theme") as any) || "light",
    soundEnabled: false,
    reducedMotion: false,
    strictSections: true,
    defaultMockDuration: 60,
  },

  inProgressAttempts: [],

  fetchManifest: async () => {
    set({ loadingManifest: true, manifestError: null });
    try {
      // Use relative path for manifest
      const res = await fetch("./data/manifest.json");
      if (!res.ok) {
        throw new Error(`Failed to load tests manifest: ${res.statusText}`);
      }
      const data: TestManifest = await res.json();
      set({ manifest: data, loadingManifest: false });
    } catch (err: any) {
      set({ manifestError: err.message, loadingManifest: false });
    }
  },

  fetchTest: async (testId: string) => {
    const current = get().activeTest;
    if (current && current.id === testId) {
      return current;
    }

    set({ loadingTest: true, testError: null });
    try {
      const res = await fetch(`./data/tests/${testId}.json`);
      if (!res.ok) {
        throw new Error(`Failed to load test ${testId}: ${res.statusText}`);
      }
      const testData: ExamTest = await res.json();
      set({ activeTest: testData, loadingTest: false });
      return testData;
    } catch (err: any) {
      set({ testError: err.message, loadingTest: false });
      return null;
    }
  },

  refreshStats: async () => {
    try {
      const stats = await getUserStats();
      set({ userStats: stats });
    } catch (e) {
      console.error("Failed to load user stats", e);
    }
  },

  refreshInProgress: async () => {
    try {
      const attempts = await getAllInProgressAttempts();
      set({ inProgressAttempts: attempts });
    } catch (e) {
      console.error("Failed to load in progress attempts", e);
    }
  },

  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    set({ settings: updated });
    if (updated.theme) {
      localStorage.setItem("examquest_theme", updated.theme);
      if (
        updated.theme === "dark" ||
        (updated.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      ) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  },

  removeInProgress: async (testId: string) => {
    await clearInProgressAttempt(testId);
    await get().refreshInProgress();
  },

  addPracticeStats: async (earnedXp: number, answered: number, correct: number) => {
    try {
      const updated = await recordPracticeSession(earnedXp, answered, correct);
      set({ userStats: updated });
    } catch (e) {
      console.error("Failed to record practice stats", e);
    }
  },
}));

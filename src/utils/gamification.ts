/**
 * Gamification utility functions: Level calculations, XP bonuses, badges, and streaks.
 */

export interface LevelInfo {
  level: number;
  title: string;
  currentXp: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
}

const LEVEL_TITLES = [
  "Rookie Aspirant",
  "Diligent Scholar",
  "Logic Detective",
  "Aptitude Ace",
  "Speed Solver",
  "Section Master",
  "Mock Veteran",
  "High Ranker",
  "Exam Conqueror",
  "Future Officer",
];

export function calculateLevel(totalXp: number): LevelInfo {
  // Level threshold curve: L1: 0, L2: 150, L3: 350, L4: 650, L5: 1050, L6: 1550, etc.
  let level = 1;
  let prevThreshold = 0;
  let nextThreshold = 150;

  while (totalXp >= nextThreshold && level < 50) {
    level++;
    prevThreshold = nextThreshold;
    nextThreshold = Math.round(prevThreshold + 150 * Math.pow(1.2, level - 1));
  }

  const xpInLevel = Math.max(0, totalXp - prevThreshold);
  const xpNeeded = nextThreshold - prevThreshold;
  const progressPercent = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

  const titleIndex = Math.min(LEVEL_TITLES.length - 1, level - 1);
  const title = LEVEL_TITLES[titleIndex];

  return {
    level,
    title,
    currentXp: totalXp,
    xpForCurrentLevel: prevThreshold,
    xpForNextLevel: nextThreshold,
    progressPercent,
  };
}

export function calculateQuestionXp(isCorrect: boolean, currentStreak: number): number {
  if (!isCorrect) return 0;
  let xp = 10; // Base XP
  if (currentStreak >= 10) {
    xp += 10;
  } else if (currentStreak >= 5) {
    xp += 5;
  } else if (currentStreak >= 3) {
    xp += 2;
  }
  return xp;
}

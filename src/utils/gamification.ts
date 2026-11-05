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

export type LeagueTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export function getLeagueTier(xp: number): LeagueTier {
  if (xp >= 1500) return "Diamond";
  if (xp >= 1000) return "Platinum";
  if (xp >= 600) return "Gold";
  if (xp >= 250) return "Silver";
  return "Bronze";
}

export function getTierColor(tier: LeagueTier): {
  bg: string;
  text: string;
  border: string;
  badge: string;
} {
  switch (tier) {
    case "Diamond":
      return {
        bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        text: "text-cyan-400",
        border: "border-cyan-500/40",
        badge: "bg-gradient-to-r from-cyan-500 to-blue-500 text-white",
      };
    case "Platinum":
      return {
        bg: "bg-violet-500/10 text-violet-400 border-violet-500/30",
        text: "text-violet-400",
        border: "border-violet-500/40",
        badge: "bg-gradient-to-r from-violet-500 to-purple-500 text-white",
      };
    case "Gold":
      return {
        bg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        text: "text-amber-400",
        border: "border-amber-500/40",
        badge: "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold",
      };
    case "Silver":
      return {
        bg: "bg-slate-300/10 text-slate-300 border-slate-400/30",
        text: "text-slate-300",
        border: "border-slate-400/40",
        badge: "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 font-bold",
      };
    case "Bronze":
      return {
        bg: "bg-amber-700/10 text-amber-600 border-amber-700/30",
        text: "text-amber-600",
        border: "border-amber-700/40",
        badge: "bg-gradient-to-r from-amber-700 to-orange-800 text-white",
      };
  }
}

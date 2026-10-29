/**
 * Top navigation bar with streak, XP counters, navigation links, and theme toggle.
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Flame,
  Zap,
  BookOpen,
  Home,
  BookmarkCheck,
  BarChart3,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { userStats, settings, updateSettings } = useAppStore();

  const toggleTheme = () => {
    const nextTheme = settings.theme === "dark" ? "light" : "dark";
    updateSettings({ theme: nextTheme });
  };

  const navLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: "/library", label: "Library", icon: BookOpen },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { to: "/mistakes", label: "Mistakes", icon: BookmarkCheck },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  const isCurrent = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
              Exam<span className="text-blue-600 dark:text-sky-400">Quest</span>
            </span>
            <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 -mt-1 tracking-wider uppercase">
              SSC Mock Engine
            </span>
          </div>
        </Link>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isCurrent(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-sky-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side stats badges & theme toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Streak Badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 font-bold text-xs shadow-sm"
            title={`${userStats.streak} day streak`}
          >
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500 animate-pulse" />
            <span>{userStats.streak} d</span>
          </div>

          {/* XP Badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-sky-400 font-bold text-xs shadow-sm"
            title={`${userStats.xp} Total XP`}
          >
            <Zap className="w-4 h-4 fill-blue-500 text-blue-500" />
            <span>{userStats.xp} XP</span>
          </div>

          {/* Theme switch */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {settings.theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

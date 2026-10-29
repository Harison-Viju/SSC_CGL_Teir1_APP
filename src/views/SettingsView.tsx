/**
 * Settings View: Configuration for theme, sound, animations, data backup & restore.
 */

import React, { useState } from "react";
import {
  Settings,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Sparkles,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { db, getUserStats, saveUserStats } from "../db";

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, userStats, refreshStats } = useAppStore();
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleExportData = async () => {
    try {
      const attempts = await db.attempts.toArray();
      const bookmarks = await db.bookmarks.toArray();
      const flags = await db.flags.toArray();
      const stats = await getUserStats();

      const backup = {
        app: "ExamQuest",
        version: 1,
        exportedAt: new Date().toISOString(),
        stats,
        attempts,
        bookmarks,
        flags,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `examquest-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backup = JSON.parse(text);

        if (backup.app !== "ExamQuest") {
          alert("Invalid backup file format.");
          return;
        }

        if (backup.attempts && Array.isArray(backup.attempts)) {
          for (const att of backup.attempts) {
            await db.attempts.put(att);
          }
        }

        if (backup.stats) {
          await saveUserStats(backup.stats);
          await refreshStats();
        }

        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (err) {
        alert("Failed to parse backup JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = async () => {
    if (
      window.confirm(
        "Are you sure you want to reset all test attempts and statistics? This cannot be undone."
      )
    ) {
      await db.attempts.clear();
      await db.inProgress.clear();
      await db.bookmarks.clear();
      await saveUserStats({
        xp: 0,
        streak: 1,
        lastActiveDate: new Date().toISOString().split("T")[0],
        completedTestsCount: 0,
        totalAnswered: 0,
        totalCorrect: 0,
      });
      await refreshStats();
      alert("Progress reset successfully.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-7 h-7 text-blue-600 dark:text-sky-400" />
          App Preferences & Settings
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Customize your mock test interface, theme, audio feedback, and local data.
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance Section */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Appearance</h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700/60">
            <div>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-200 block">
                Theme
              </span>
              <span className="text-xs text-slate-500">Choose light or dark visual theme</span>
            </div>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-700 p-1 text-xs font-bold">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateSettings({ theme: t })}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                    settings.theme === t
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-sky-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Sound toggle */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/60">
            <div>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-200 block">
                Sound Effects
              </span>
              <span className="text-xs text-slate-500">Audio feedback on answers and timer</span>
            </div>
            <button
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`p-2 rounded-xl transition-colors ${
                settings.soundEnabled
                  ? "bg-blue-100 dark:bg-blue-950 text-blue-600"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-400"
              }`}
            >
              {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>

          {/* Motion toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-200 block">
                Reduced Motion
              </span>
              <span className="text-xs text-slate-500">
                Disable energetic bounces and confetti animations
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Examination Preferences */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Exam Simulation</h2>

          <div className="flex items-center justify-between py-2">
            <div>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-200 block">
                Strict Section Timing
              </span>
              <span className="text-xs text-slate-500">
                Lock finished sections when their 15 min limit expires (True SSC format)
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.strictSections}
              onChange={(e) => updateSettings({ strictSections: e.target.checked })}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Data & Backup */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Data Storage & Backup (Local-First)
          </h2>
          <p className="text-xs text-slate-500">
            All your mock attempts, scores, and bookmarks stay 100% private in your browser's
            IndexedDB storage. Use the backup tools below to transfer data between devices.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={handleExportData}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Export JSON Backup
            </button>

            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              Import Backup
              <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
            </label>

            <button
              onClick={handleResetData}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-xs rounded-xl border border-red-200 dark:border-red-900 transition-colors ml-auto"
            >
              <Trash2 className="w-4 h-4" />
              Reset All Progress
            </button>
          </div>

          {exportSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Backup exported successfully!
            </div>
          )}

          {importSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Backup imported and restored successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

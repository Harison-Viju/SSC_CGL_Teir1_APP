/**
 * Bottom mobile navigation dock for small screens.
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Trophy, BookmarkCheck, BarChart3, Settings } from "lucide-react";

export const MobileNav: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/library", label: "Library", icon: BookOpen },
    { to: "/leaderboard", label: "Rankings", icon: Trophy },
    { to: "/mistakes", label: "Mistakes", icon: BookmarkCheck },
    { to: "/analytics", label: "Stats", icon: BarChart3 },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  const isCurrent = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex justify-around items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isCurrent(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
              active
                ? "text-blue-600 dark:text-sky-400 font-bold scale-105"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
};

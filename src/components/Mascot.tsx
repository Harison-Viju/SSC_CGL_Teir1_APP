/**
 * Quizzy: The friendly, expressive animated mascot for ExamQuest.
 * Original layered SVG with smooth Framer Motion states.
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";

export type MascotState =
  | "idle"
  | "thinking"
  | "happy"
  | "celebrate"
  | "sad"
  | "shocked"
  | "proud"
  | "cheer"
  | "sleepy"
  | "calm"
  | "focus";

interface MascotProps {
  state?: MascotState;
  size?: "sm" | "md" | "lg" | "xl";
  message?: string;
  className?: string;
  showBubble?: boolean;
}

export const Mascot: React.FC<MascotProps> = ({
  state = "idle",
  size = "md",
  message,
  className = "",
  showBubble = true,
}) => {
  const sizeMap = {
    sm: "w-16 h-16",
    md: "w-28 h-28",
    lg: "w-40 h-40",
    xl: "w-56 h-56",
  };

  // State-specific bounce/rotation variants
  const mascotVariants: Record<string, any> = {
    idle: {
      y: [0, -4, 0],
      transition: { repeat: Infinity, duration: 3, ease: "easeInOut" },
    },
    calm: {
      y: [0, -2, 0],
      scale: [1, 1.025, 1],
      transition: { repeat: Infinity, duration: 4.5, ease: "easeInOut" },
    },
    focus: {
      y: [0, -1.5, 0],
      transition: { repeat: Infinity, duration: 3.2, ease: "easeInOut" },
    },
    thinking: {
      rotate: [-3, 3, -3],
      y: [0, -2, 0],
      transition: { repeat: Infinity, duration: 2.2, ease: "easeInOut" },
    },
    happy: {
      y: [0, -10, 0],
      scale: [1, 1.05, 1],
      transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" },
    },
    celebrate: {
      y: [0, -14, 0],
      rotate: [-6, 6, -6],
      scale: [1, 1.08, 1],
      transition: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
    },
    sad: {
      y: [0, 4, 0],
      rotate: [-1, 1, -1],
      transition: { repeat: Infinity, duration: 3.5, ease: "easeInOut" },
    },
    shocked: {
      x: [-2, 2, -2, 2, 0],
      scale: [1, 1.06, 1],
      transition: { repeat: Infinity, duration: 0.4 },
    },
    proud: {
      y: [0, -6, 0],
      scale: [1, 1.03, 1],
      transition: { repeat: Infinity, duration: 2.5, ease: "easeInOut" },
    },
    cheer: {
      y: [0, -12, 0],
      rotate: [0, -5, 5, 0],
      transition: { repeat: Infinity, duration: 1.0 },
    },
    sleepy: {
      y: [0, 2, 0],
      transition: { repeat: Infinity, duration: 4, ease: "easeInOut" },
    },
  };

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Speech Bubble */}
      <AnimatePresence>
        {showBubble && message && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className="mb-3 max-w-xs px-4 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl shadow-md border border-amber-200 dark:border-slate-700 text-sm font-medium text-center relative"
          >
            {message}
            {/* Bubble arrow */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white dark:border-t-slate-800" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG Mascot Body */}
      <motion.div
        variants={mascotVariants}
        animate={state}
        className={`${sizeMap[size]} relative flex items-center justify-center`}
      >
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full drop-shadow-lg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Glow / Sparkles for Happy & Celebrate & Calm */}
          {(state === "happy" || state === "celebrate" || state === "proud") && (
            <g className="animate-pulse">
              <path
                d="M20 30L23 37L30 40L23 43L20 50L17 43L10 40L17 37L20 30Z"
                fill="#FBBF24"
              />
              <path
                d="M135 25L137 31L143 33L137 35L135 41L133 35L127 33L133 31L135 25Z"
                fill="#F59E0B"
              />
            </g>
          )}

          {/* Gentle Zen Aura for Calm state */}
          {state === "calm" && (
            <circle
              cx="80"
              cy="85"
              r="62"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2"
              opacity="0.35"
              strokeDasharray="4 4"
              className="animate-spin"
              style={{ animationDuration: "25s" }}
            />
          )}

          {/* Cute Little Wings / Arms */}
          <motion.ellipse
            cx="32"
            cy="95"
            rx="12"
            ry="20"
            fill="#0284C7"
            transform="rotate(-20 32 95)"
            animate={
              state === "celebrate" || state === "cheer"
                ? { rotate: [-40, -10, -40], y: [-6, 2, -6] }
                : {}
            }
            transition={{ repeat: Infinity, duration: 0.6 }}
          />
          <motion.ellipse
            cx="128"
            cy="95"
            rx="12"
            ry="20"
            fill="#0284C7"
            transform="rotate(20 128 95)"
            animate={
              state === "celebrate" || state === "cheer"
                ? { rotate: [40, 10, 40], y: [-6, 2, -6] }
                : {}
            }
            transition={{ repeat: Infinity, duration: 0.6 }}
          />

          {/* Main Round Body (Vibrant Indigo-Sky Gradient) */}
          <circle cx="80" cy="85" r="54" fill="url(#quizzyBodyGrad)" />

          {/* Soft Belly Patch */}
          <ellipse cx="80" cy="98" rx="34" ry="32" fill="#E0F2FE" />

          {/* Scholar Cap / Ear Tuft Hat */}
          <g transform="translate(0, -6)">
            {/* Cap Diamond */}
            <path
              d="M80 18L112 28L80 38L48 28L80 18Z"
              fill="#1E293B"
              stroke="#F59E0B"
              strokeWidth="2"
            />
            {/* Cap Skull base */}
            <path
              d="M60 32C60 32 68 44 80 44C92 44 100 32 100 32L60 32Z"
              fill="#0F172A"
            />
            {/* Gold Tassel button & string */}
            <circle cx="80" cy="28" r="3.5" fill="#F59E0B" />
            <path
              d="M80 28C88 32 96 38 97 46"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="97" cy="47" r="2.5" fill="#D97706" />
          </g>

          {/* Big Cheerful Eyes */}
          <g>
            {state === "happy" || state === "cheer" ? (
              // Inverted arcs for cheerful happy eyes (^ ^)
              <>
                <path
                  d="M56 75C60 67 70 67 74 75"
                  stroke="#0F172A"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M86 75C90 67 100 67 104 75"
                  stroke="#0F172A"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </>
            ) : state === "calm" ? (
              // Gentle, serene peaceful eyes with calm smile
              <>
                <path
                  d="M56 76C60 72 70 72 74 76"
                  stroke="#0F172A"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d="M86 76C90 72 100 72 104 76"
                  stroke="#0F172A"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </>
            ) : state === "sleepy" ? (
              // Droopy sleepy eyelids
              <>
                <path
                  d="M56 78C62 82 68 82 74 78"
                  stroke="#0F172A"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d="M86 78C92 82 98 82 104 78"
                  stroke="#0F172A"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </>
            ) : state === "thinking" || state === "focus" ? (
              // Curious / Focused eyes
              <>
                <circle cx="65" cy="74" r="11" fill="white" />
                <circle cx="68" cy="70" r="6" fill="#0F172A" />
                <circle cx="70" cy="68" r="2.5" fill="white" />

                <circle cx="95" cy="74" r="11" fill="white" />
                <circle cx="98" cy="70" r="6" fill="#0F172A" />
                <circle cx="100" cy="68" r="2.5" fill="white" />
              </>
            ) : state === "shocked" ? (
              // Wide open eyes
              <>
                <circle cx="64" cy="72" r="13" fill="white" stroke="#0F172A" strokeWidth="2" />
                <circle cx="64" cy="72" r="5" fill="#0F172A" />
                <circle cx="96" cy="72" r="13" fill="white" stroke="#0F172A" strokeWidth="2" />
                <circle cx="96" cy="72" r="5" fill="#0F172A" />
              </>
            ) : (
              // Standard Big Glossy Eyes (Blinking capable)
              <>
                <circle cx="64" cy="75" r="10.5" fill="white" />
                <circle cx="65" cy="75" r="6" fill="#0F172A" />
                <circle cx="67" cy="72.5" r="2.5" fill="white" />

                <circle cx="96" cy="75" r="10.5" fill="white" />
                <circle cx="97" cy="75" r="6" fill="#0F172A" />
                <circle cx="99" cy="72.5" r="2.5" fill="white" />
              </>
            )}
          </g>

          {/* Cute Rosy Cheeks */}
          <circle cx="50" cy="86" r="6.5" fill="#FDA4AF" opacity="0.75" />
          <circle cx="110" cy="86" r="6.5" fill="#FDA4AF" opacity="0.75" />

          {/* Golden Beak / Mouth */}
          {state === "shocked" ? (
            <ellipse cx="80" cy="86" rx="6" ry="8" fill="#D97706" />
          ) : state === "sad" ? (
            <path
              d="M74 88C77 84 83 84 86 88"
              stroke="#D97706"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          ) : (
            // Cheerful golden beak triangle
            <polygon points="73,81 87,81 80,90" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
          )}

          {/* Scholar Medal Badge on Belly */}
          <circle cx="80" cy="110" r="7" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" />
          <path
            d="M80 106L81.5 109L85 109.5L82.5 112L83 115.5L80 113.8L77 115.5L77.5 112L75 109.5L78.5 109L80 106Z"
            fill="#B45309"
          />

          {/* Little Yellow Paws */}
          <ellipse cx="64" cy="138" rx="8" ry="5" fill="#F59E0B" />
          <ellipse cx="96" cy="138" rx="8" ry="5" fill="#F59E0B" />

          {/* Definitions */}
          <defs>
            <linearGradient id="quizzyBodyGrad" x1="26" y1="31" x2="134" y2="139" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="0.6" stopColor="#0284C7" />
              <stop offset="1" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </div>
  );
};

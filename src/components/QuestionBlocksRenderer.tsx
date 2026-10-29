import React from "react";
import type { QuestionBlock } from "../types";

interface QuestionBlocksRendererProps {
  blocks?: QuestionBlock[];
  fallbackStem?: string;
  className?: string;
}

/**
 * QuestionBlocksRenderer
 * Renders structured question blocks with:
 * - Labels as small bold tinted tags (e.g. STATEMENT, CONCLUSIONS)
 * - List items as separate rows with roman-numeral or number badges
 * - Paragraphs as normal text with 17px mobile / 18px desktop, line-height 1.65, ~70ch max width
 * - 12-16px generous vertical spacing between blocks
 * - Fallback to white-space: pre-line when blocks are not provided
 */
export const QuestionBlocksRenderer: React.FC<QuestionBlocksRendererProps> = ({
  blocks,
  fallbackStem = "",
  className = "",
}) => {
  if (!blocks || blocks.length === 0) {
    if (!fallbackStem) return null;
    return (
      <div
        className={`text-[17px] sm:text-[18px] leading-[1.65] tracking-normal text-slate-200 max-w-[70ch] whitespace-pre-line ${className}`}
      >
        {fallbackStem}
      </div>
    );
  }

  return (
    <div className={`space-y-3.5 ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === "label") {
          return (
            <div key={idx} className="pt-2 pb-0.5 first:pt-0">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-sky-950/80 border border-sky-800/70 text-sky-300 shadow-xs">
                {block.text}
              </span>
            </div>
          );
        }

        if (block.type === "list_item") {
          return (
            <div key={idx} className="flex items-start gap-3 pl-1 sm:pl-2">
              {block.marker && (
                <span className="shrink-0 min-w-6 h-6 px-1.5 rounded-md bg-slate-800/90 border border-slate-700/80 text-sky-300 font-bold text-xs flex items-center justify-center mt-0.5 shadow-xs tabular-nums">
                  {block.marker}
                </span>
              )}
              <div className="text-[17px] sm:text-[18px] leading-[1.65] tracking-normal text-slate-200 max-w-[70ch]">
                {block.text}
              </div>
            </div>
          );
        }

        // Paragraph
        return (
          <p
            key={idx}
            className="text-[17px] sm:text-[18px] leading-[1.65] tracking-normal text-slate-200 max-w-[70ch]"
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
};

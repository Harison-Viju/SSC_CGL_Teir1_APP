/**
 * About & Guide View: Architecture notes, open-source documentation, and PDF addition instructions.
 */

import React from "react";
import { HelpCircle, Terminal, FileText, CheckCircle2, Shield, Heart } from "lucide-react";

export const AboutView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <HelpCircle className="w-7 h-7 text-blue-600 dark:text-sky-400" />
          About ExamQuest & Guide
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          A zero-running-cost, local-first mock test platform with automated PDF question ingestion.
        </p>
      </div>

      <div className="space-y-6">
        {/* Core Principles Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            Core Philosophy & Privacy
          </h2>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Running Cost:</strong> No cloud database, no paid LLM/OCR APIs, no
                servers to maintain. Static files served directly via GitHub Pages.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>100% Private Local Storage:</strong> All your mock test attempts, scores,
                time logs, and mistake notebooks live in your browser's IndexedDB. No tracking, no
                accounts, no surveillance.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Rule-Based Ingestion:</strong> Automated Python pipeline parses
                previous-year PDFs into clean JSON and high-resolution WebP images using geometry,
                bounding boxes, and deterministic regex.
              </span>
            </li>
          </ul>
        </div>

        {/* How to Add New Papers Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-500" />
            How to Ingest New Exam Papers
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Adding new previous-year or memory-based exam papers is completely automated:
          </p>

          <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-mono space-y-2 overflow-x-auto">
            <div className="text-slate-400"># 1. Drop your PDF into the pdfs/ folder</div>
            <div>cp my_exam_paper.pdf pdfs/ssc/</div>
            <div className="text-slate-400 pt-2"># 2. Run the offline ingestion pipeline</div>
            <div>python3 -m ingest --all</div>
            <div className="text-slate-400 pt-2"># 3. Start local development preview</div>
            <div>npm run dev</div>
          </div>
        </div>

        {/* Overrides Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            Question Overrides & Corrections
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Publishers' memory-based PDFs occasionally feature typos or disputed answers. You can
            override any parsed question by placing a JSON patch in <code>overrides/&lt;test_id&gt;.json</code>.
          </p>
        </div>
      </div>
    </div>
  );
};

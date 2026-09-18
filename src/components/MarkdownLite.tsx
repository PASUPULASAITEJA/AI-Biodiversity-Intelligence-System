"use client";

import React from "react";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Regex to match bold **text**, links [text](url), and italics *text*
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const content = part.slice(2, -2);
      // Highlight metrics like +15-25%
      if (content.includes("%") || content.includes("+") || content.includes("t C/ha")) {
        return (
          <span
            key={`${keyPrefix}-${i}`}
            className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-xs tracking-wide mx-1"
          >
            {content}
          </span>
        );
      }
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-100">
          {content}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={`${keyPrefix}-${i}`} className="italic text-emerald-200/90 font-mono text-xs">
          {part.slice(1, -1)}
        </em>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline underline-offset-4 decoration-emerald-500/50 hover:decoration-emerald-400 font-medium transition-colors"
        >
          <span>{linkMatch[1]}</span>
          <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

export default function MarkdownLite({ text }: { text: string }) {
  if (!text) return null;
  const blocks = text.split(/\n\n+/);

  return (
    <div className="space-y-3.5 text-sm leading-relaxed text-slate-200">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (trimmed === "---" || trimmed === "***") {
          return <hr key={bi} className="my-4 border-emerald-900/40" />;
        }
        
        // Headings
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={bi} className="text-base font-bold text-emerald-400 flex items-center gap-2 mt-3 pt-2 border-t border-emerald-900/30">
              {renderInline(trimmed.replace(/^##\s*/, ""), `h2-${bi}`)}
            </h2>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={bi} className="text-sm font-semibold text-emerald-300 mt-2">
              {renderInline(trimmed.replace(/^###\s*/, ""), `h3-${bi}`)}
            </h3>
          );
        }

        // Section Cards based on emoji headers (📋 Recommendation, 🔬 Why It Works, 📊 Metrics, etc.)
        if (trimmed.startsWith("📋 **Recommendation:**")) {
          return (
            <div key={bi} className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/40 to-teal-950/20 border border-emerald-500/30 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center gap-1.5">
                <span>📋</span> Recommendation Action
              </div>
              <p className="text-slate-100 font-medium leading-relaxed">
                {renderInline(trimmed.replace(/^📋 \*\*Recommendation:\*\*\s*/, ""), `rec-${bi}`)}
              </p>
            </div>
          );
        }

        if (trimmed.startsWith("🔬 **Why It Works")) {
          return (
            <div key={bi} className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
              <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1.5 flex items-center gap-1.5">
                <span>🔬</span> Scientific Mechanism
              </div>
              <p className="text-slate-300 leading-relaxed text-xs sm:text-sm">
                {renderInline(trimmed.replace(/^🔬 \*\*Why It Works(?:\s*\(Scientific Reasoning\))?:\*\*\s*/, ""), `mech-${bi}`)}
              </p>
            </div>
          );
        }

        if (trimmed.startsWith("🔍 **Cross-Variable")) {
          return (
            <div key={bi} className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20">
              <div className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-1.5 flex items-center gap-1.5">
                <span>🔍</span> Compounding Ecological Analysis
              </div>
              <p className="text-slate-300 leading-relaxed text-xs sm:text-sm">
                {renderInline(trimmed.replace(/^🔍 \*\*Cross-Variable Compounding Analysis:\*\*\s*/, ""), `cross-${bi}`)}
              </p>
            </div>
          );
        }

        if (trimmed.startsWith("❓ **Follow-up")) {
          return (
            <div key={bi} className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-amber-200/90 text-xs sm:text-sm">
              <span className="font-semibold text-amber-300">Observation Request: </span>
              {renderInline(trimmed.replace(/^❓ \*\*Follow-up Observation:\*\*\s*/, ""), `fol-${bi}`)}
            </div>
          );
        }

        const lines = block.split("\n");
        const isBulletList = lines.every((l) => {
          const t = l.trim();
          return !t || t.startsWith("- ") || t.startsWith("* ") || t.startsWith("• ");
        });

        if (isBulletList && lines.some((l) => l.trim().length > 0)) {
          return (
            <ul key={bi} className="space-y-1.5 pl-2 text-slate-300 text-xs sm:text-sm">
              {lines
                .filter((l) => l.trim().length > 0)
                .map((l, li) => {
                  const cleaned = l.trim().replace(/^[-*•]\s*/, "");
                  return (
                    <li key={li} className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <div className="flex-1">{renderInline(cleaned, `l${bi}-${li}`)}</div>
                    </li>
                  );
                })}
            </ul>
          );
        }

        return (
          <p key={bi} className="whitespace-pre-wrap text-slate-200">
            {lines.map((l, li) => (
              <React.Fragment key={li}>
                {renderInline(l, `p${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

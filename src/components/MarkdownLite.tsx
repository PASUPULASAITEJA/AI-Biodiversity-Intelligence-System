"use client";

import React from "react";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Regex to match bold **text**, links [text](url), and italics *text*
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={`${keyPrefix}-${i}`} className="italic text-slate-800">
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
          className="text-emerald-700 underline decoration-emerald-300 hover:text-emerald-900 font-medium"
        >
          {linkMatch[1]}
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
    <div className="space-y-3 text-sm leading-relaxed text-slate-800">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (trimmed === "---" || trimmed === "***") {
          return <hr key={bi} className="my-3 border-slate-200" />;
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={bi} className="text-lg font-bold text-emerald-900 mt-2">
              {renderInline(trimmed.replace(/^##\s*/, ""), `h2-${bi}`)}
            </h2>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={bi} className="text-base font-semibold text-emerald-800 mt-1">
              {renderInline(trimmed.replace(/^###\s*/, ""), `h3-${bi}`)}
            </h3>
          );
        }

        const lines = block.split("\n");
        const isBulletList = lines.every((l) => {
          const t = l.trim();
          return !t || t.startsWith("- ") || t.startsWith("* ") || t.startsWith("• ");
        });

        if (isBulletList && lines.some((l) => l.trim().length > 0)) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5 text-slate-800">
              {lines
                .filter((l) => l.trim().length > 0)
                .map((l, li) => {
                  const cleaned = l.trim().replace(/^[-*•]\s*/, "");
                  return <li key={li}>{renderInline(cleaned, `l${bi}-${li}`)}</li>;
                })}
            </ul>
          );
        }

        return (
          <p key={bi} className="whitespace-pre-wrap">
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

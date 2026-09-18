import fs from "fs";
import path from "path";
import type { KnowledgeEntry } from "./types";

let cache: KnowledgeEntry[] | null = null;

/**
 * Loads and flattens all /knowledge_base/*.json files (the RAG source
 * documents) from disk. Cached in-memory after first read since the
 * knowledge base is static content bundled with the app.
 */
export function loadKnowledgeBase(): KnowledgeEntry[] {
  if (cache) return cache;

  const dir = path.join(process.cwd(), "knowledge_base");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  const entries: KnowledgeEntry[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const parsed = JSON.parse(raw) as KnowledgeEntry[];
    entries.push(...parsed);
  }

  cache = entries;
  return entries;
}

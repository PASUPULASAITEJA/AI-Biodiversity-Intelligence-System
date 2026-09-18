import { db } from "@/db";
import { knowledgeChunks } from "@/db/schema";
import { sql } from "drizzle-orm";
import { loadKnowledgeBase } from "../knowledgeBase";
import { embedText, denseCosineSimilarity, embeddingMode } from "./embeddings";
import type { KnowledgeEntry, RetrievedChunk } from "../types";

let ingestPromise: Promise<void> | null = null;
let inMemoryVectors: (KnowledgeEntry & { embedding: number[] })[] | null = null;

/** Idempotent lazy ingestion: chunks -> embeddings -> Postgres or in-memory vector store. */
export async function ensureIngested(): Promise<void> {
  if (ingestPromise) return ingestPromise;

  ingestPromise = (async () => {
    const entries = loadKnowledgeBase();

    // Prepare in-memory vectors first as foolproof fallback
    const vectors: (KnowledgeEntry & { embedding: number[] })[] = [];
    for (const entry of entries) {
      const text = [entry.topic, entry.content, entry.quantitative_impact, (entry.metrics_affected || []).join(", ")].join(
        ". ",
      );
      const embedding = await embedText(text);
      vectors.push({
        ...entry,
        embedding,
      });
    }
    inMemoryVectors = vectors;

    try {
      const countRow = await db.execute(sql`select count(*)::int as count from knowledge_chunks`);
      const existing = Number((countRow.rows[0] as { count: number } | undefined)?.count ?? 0);
      if (existing >= entries.length) return;

      console.log(
        `[ingest] Populating vector store with ${entries.length} knowledge chunks (embedding mode: ${embeddingMode()})...`,
      );

      for (const entry of vectors) {
        await db
          .insert(knowledgeChunks)
          .values({
            id: entry.id,
            category: entry.category,
            topic: entry.topic,
            content: entry.content,
            metricsAffected: entry.metrics_affected,
            source: entry.source,
            sourceUrl: entry.source_url,
            confidence: entry.confidence,
            quantitativeImpact: entry.quantitative_impact,
            applicableConditions: entry.applicable_conditions,
            embedding: entry.embedding,
          })
          .onConflictDoUpdate({
            target: knowledgeChunks.id,
            set: {
              category: entry.category,
              topic: entry.topic,
              content: entry.content,
              metricsAffected: entry.metrics_affected,
              source: entry.source,
              sourceUrl: entry.source_url,
              confidence: entry.confidence,
              quantitativeImpact: entry.quantitative_impact,
              applicableConditions: entry.applicable_conditions,
              embedding: entry.embedding,
            },
          });
      }
      console.log(`[ingest] Done. ${entries.length} chunks embedded and stored in PostgreSQL.`);
    } catch (e) {
      console.log("[ingest] Postgres not reachable, operating with high-speed in-memory vector index.");
    }
  })();

  return ingestPromise;
}

interface RetrievalOptions {
  categories?: string[];
  climate?: string | null;
  landUse?: string | null;
  k?: number;
  forceCategoryDiversity?: boolean;
}

function matchesCondition(list: string[] | undefined, needle: string | null | undefined): boolean {
  if (!list || list.length === 0) return true;
  if (!needle) return false;
  const n = needle.toLowerCase().replace(/[_-]/g, " ");
  return list.some((item) => {
    const i = item.toLowerCase();
    if (i === "any") return true;
    return n.includes(i) || i.includes(n.split(" ")[0]);
  });
}

/**
 * Multi-metric retrieval: filters by metadata (category/climate/land_use)
 * then ranks by cosine similarity, forcing category diversity so results
 * span soil/biodiversity/climate/land_use/human_impact rather than a single
 * variable. Logs each retrieved chunk per the spec's observability requirement.
 */
export async function searchKnowledge(
  query: string,
  options: RetrievalOptions = {},
): Promise<RetrievedChunk[]> {
  await ensureIngested();
  const { categories, climate, landUse, k = 6, forceCategoryDiversity = true } = options;

  let candidates: (KnowledgeEntry & { embedding: number[] })[] = [];

  try {
    const rows = await db.select().from(knowledgeChunks);
    if (rows && rows.length > 0) {
      candidates = rows.map((r) => ({
        id: r.id,
        category: r.category as KnowledgeEntry["category"],
        topic: r.topic,
        content: r.content,
        metrics_affected: (r.metricsAffected as string[]) ?? [],
        source: r.source ?? "",
        source_url: r.sourceUrl ?? "",
        confidence: (r.confidence as KnowledgeEntry["confidence"]) ?? "medium",
        quantitative_impact: r.quantitativeImpact ?? "",
        applicable_conditions: (r.applicableConditions as KnowledgeEntry["applicable_conditions"]) ?? {
          climate: [],
          land_use: [],
        },
        embedding: (r.embedding as number[]) ?? [],
      }));
    } else {
      candidates = inMemoryVectors ?? [];
    }
  } catch {
    candidates = inMemoryVectors ?? [];
  }

  const queryVec = await embedText(query);

  if (categories && categories.length) {
    candidates = candidates.filter((c) => categories.includes(c.category));
  }

  const filtered = candidates.filter(
    (c) =>
      matchesCondition(c.applicable_conditions?.climate, climate) &&
      matchesCondition(c.applicable_conditions?.land_use, landUse),
  );
  const pool = filtered.length >= 3 ? filtered : candidates;

  const scored: RetrievedChunk[] = pool
    .map((c) => {
      const { embedding, ...rest } = c;
      void embedding;
      return {
        ...rest,
        similarity: Math.max(0, Math.min(1, denseCosineSimilarity(queryVec, c.embedding))),
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  let results: RetrievedChunk[] = [];
  if (forceCategoryDiversity) {
    const byCategory = new Map<string, RetrievedChunk[]>();
    for (const s of scored) {
      const arr = byCategory.get(s.category) ?? [];
      arr.push(s);
      byCategory.set(s.category, arr);
    }
    const cats = Array.from(byCategory.keys());
    let idx = 0;
    roundRobin: while (results.length < k) {
      let addedAny = false;
      for (const cat of cats) {
        const arr = byCategory.get(cat)!;
        if (arr[idx]) {
          results.push(arr[idx]);
          addedAny = true;
          if (results.length >= k) break roundRobin;
        }
      }
      idx++;
      if (!addedAny) break;
    }
  } else {
    results = scored.slice(0, k);
  }

  results = results.slice(0, k);

  for (const r of results) {
    console.log(
      `Retrieved knowledge: [source: ${r.source}] [category: ${r.category}] [similarity: ${r.similarity.toFixed(2)}]`,
    );
  }

  return results;
}

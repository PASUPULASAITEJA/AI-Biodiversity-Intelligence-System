import { loadKnowledgeBase } from "../knowledgeBase";
import { buildVocabulary, vectorize, toDense, type Vocabulary } from "./tfidf";

let vocabCache: Vocabulary | null = null;

function getVocabulary(): Vocabulary {
  if (vocabCache) return vocabCache;
  const entries = loadKnowledgeBase();
  const docs = entries.map((e) =>
    [e.topic, e.content, e.category, e.metrics_affected.join(" "), e.quantitative_impact].join(" "),
  );
  vocabCache = buildVocabulary(docs);
  return vocabCache;
}

const USE_OPENAI = Boolean(process.env.OPENAI_API_KEY);

async function embedWithOpenAI(text: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/** Embeds text into a vector. Uses OpenAI embeddings when a key is configured,
 *  otherwise falls back to a deterministic TF-IDF vector built from the
 *  knowledge base corpus (guarantees the RAG pipeline works fully offline). */
export async function embedText(text: string): Promise<number[]> {
  if (USE_OPENAI) {
    const vec = await embedWithOpenAI(text);
    if (vec) return vec;
  }
  const vocab = getVocabulary();
  return toDense(vectorize(text, vocab), vocab.terms);
}

export function denseCosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function embeddingMode(): "openai" | "tfidf" {
  return USE_OPENAI ? "openai" : "tfidf";
}

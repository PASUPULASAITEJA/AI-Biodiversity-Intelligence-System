// Lightweight, dependency-free TF-IDF vectorizer used as our embedding
// function. This acts as the "vector store" math behind the RAG layer
// (ChromaDB-equivalent) without requiring an external embeddings API,
// so retrieval works fully offline/deterministically. If OPENAI_API_KEY
// is configured, src/lib/rag/embeddings.ts upgrades to real semantic
// embeddings transparently.

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "to", "for", "with", "is",
  "are", "was", "were", "be", "been", "by", "as", "at", "this", "that",
  "these", "those", "it", "its", "into", "over", "under", "than", "such",
  "which", "can", "may", "also", "has", "have", "had", "from", "per", "vs",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%.\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface Vocabulary {
  terms: string[];
  idf: Record<string, number>;
}

export function buildVocabulary(documents: string[]): Vocabulary {
  const docFreq: Record<string, number> = {};
  const tokenizedDocs = documents.map(tokenize);

  for (const tokens of tokenizedDocs) {
    const seen = new Set(tokens);
    for (const term of seen) {
      docFreq[term] = (docFreq[term] || 0) + 1;
    }
  }

  const N = documents.length || 1;
  const terms = Object.keys(docFreq);
  const idf: Record<string, number> = {};
  for (const term of terms) {
    idf[term] = Math.log((1 + N) / (1 + docFreq[term])) + 1;
  }

  return { terms, idf };
}

export function vectorize(text: string, vocab: Vocabulary): Map<string, number> {
  const tokens = tokenize(text);
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

  const vec = new Map<string, number>();
  const total = tokens.length || 1;
  for (const [term, count] of Object.entries(tf)) {
    const idf = vocab.idf[term];
    if (idf === undefined) continue; // out-of-vocabulary term
    vec.set(term, (count / total) * idf);
  }
  return vec;
}

/** Sparse-map friendly cosine similarity. */
export function cosineSimilaritySparse(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const v of a.values()) normA += v * v;
  for (const v of b.values()) normB += v * v;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [term, val] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += val * other;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Convert a sparse vector to a dense array over a fixed term ordering, for DB storage. */
export function toDense(vec: Map<string, number>, terms: string[]): number[] {
  return terms.map((t) => vec.get(t) || 0);
}

export function fromDense(dense: number[], terms: string[]): Map<string, number> {
  const map = new Map<string, number>();
  terms.forEach((t, i) => {
    if (dense[i]) map.set(t, dense[i]);
  });
  return map;
}

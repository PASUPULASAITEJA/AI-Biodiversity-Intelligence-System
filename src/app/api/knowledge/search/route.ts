import { searchKnowledge } from "@/lib/rag/retrieval";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge/search?q=...&category=soil&climate=semi-arid&land_use=monoculture&k=6
 * Debug endpoint to test raw RAG retrieval directly against the vector store.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (!q) {
    return Response.json({ error: "Missing required query param 'q'" }, { status: 400 });
  }
  const category = url.searchParams.get("category");
  const climate = url.searchParams.get("climate");
  const landUse = url.searchParams.get("land_use");
  const k = Number(url.searchParams.get("k") ?? "6") || 6;

  const results = await searchKnowledge(q, {
    categories: category ? [category] : undefined,
    climate,
    landUse,
    k,
  });

  return Response.json({
    query: q,
    filters: { category, climate, land_use: landUse },
    count: results.length,
    results,
  });
}

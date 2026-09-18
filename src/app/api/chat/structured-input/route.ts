import { randomUUID } from "crypto";
import { runChatTurn } from "@/lib/reasoningEngine";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/structured-input
 * Dedicated endpoint for pure structured JSON ingestion, e.g.:
 * {
 *   "sessionId": "...",
 *   "soil_organic_carbon_pct": 0.3,
 *   "rainfall": "low",
 *   "land_use": "monoculture_wheat",
 *   "region": "semi-arid",
 *   "coordinates": { "lat": 26.9, "lon": 70.9 }
 * }
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId : randomUUID();
  const { sessionId: _s, ...structured } = body;
  void _s;

  try {
    const result = await runChatTurn({ sessionId, structured });
    return Response.json(result);
  } catch (err) {
    console.error("[api/chat/structured-input] error", err);
    return Response.json({ error: "Internal error processing structured input" }, { status: 500 });
  }
}

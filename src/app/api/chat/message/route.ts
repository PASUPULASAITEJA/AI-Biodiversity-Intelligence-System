import { randomUUID } from "crypto";
import { runChatTurn } from "@/lib/reasoningEngine";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/message
 * Accepts free text, structured JSON, or a mix of both in the same request:
 *   { "sessionId": "...", "message": "Biodiversity is declining on my land, semi-arid region" }
 *   { "sessionId": "...", "soil_organic_carbon_pct": 0.3, "rainfall": "low", "crop": "monoculture wheat", "region": "semi-arid" }
 *   { "sessionId": "...", "message": "...", "soil_organic_carbon_pct": 0.3 }
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
  const message = typeof body.message === "string" ? body.message : undefined;

  const explicitStructured =
    body.structured && typeof body.structured === "object" ? (body.structured as Record<string, unknown>) : undefined;

  const { sessionId: _s, message: _m, structured: _st, ...rest } = body;
  void _s;
  void _m;
  void _st;

  const structured = explicitStructured ?? (Object.keys(rest).length ? rest : undefined);

  if (!message && !structured) {
    return Response.json({ error: "Provide at least a 'message' string or structured fields" }, { status: 400 });
  }

  try {
    const result = await runChatTurn({ sessionId, message, structured });
    return Response.json(result);
  } catch (err) {
    console.error("[api/chat/message] error", err);
    return Response.json({ error: "Internal error processing chat turn" }, { status: 500 });
  }
}

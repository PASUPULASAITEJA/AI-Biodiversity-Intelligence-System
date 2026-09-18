import { getHistory } from "@/lib/profileStore";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const history = await getHistory(sessionId);
  return Response.json({ sessionId, messages: history });
}

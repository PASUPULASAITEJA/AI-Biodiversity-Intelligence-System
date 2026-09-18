import { resetProfile, getOrCreateProfile } from "@/lib/profileStore";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  await resetProfile(sessionId);
  const profile = await getOrCreateProfile(sessionId);
  return Response.json({ ok: true, profile });
}

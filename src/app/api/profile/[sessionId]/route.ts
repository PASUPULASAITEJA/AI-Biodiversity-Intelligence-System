import { getOrCreateProfile } from "@/lib/profileStore";
import { checkMissingCriticalFields } from "@/lib/reasoningEngine";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const profile = await getOrCreateProfile(sessionId);
  const missingFields = checkMissingCriticalFields(profile);
  return Response.json({ profile, missingCriticalFields: missingFields });
}

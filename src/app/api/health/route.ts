import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus = "connected";
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbStatus = "in_memory_fallback";
  }

  return Response.json({
    ok: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    service: "Darukaa.Earth AI Biodiversity Intelligence System"
  });
}

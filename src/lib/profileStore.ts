import { db } from "@/db";
import { siteProfiles, conversations, messages, recommendationsLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SiteProfileData } from "./types";
import type { ExtractedFields } from "./entityExtraction";

// In-memory fallbacks when Postgres is offline
const inMemoryProfiles = new Map<string, SiteProfileData>();
const inMemoryMessages = new Map<string, Array<{ role: "user" | "assistant" | "system"; content: string; timestamp: Date; extractedEntities?: unknown }>>();

function defaultProfile(sessionId: string): SiteProfileData {
  return {
    sessionId,
    soilPh: null,
    soilOrganicCarbonPct: null,
    soilMoisturePct: null,
    landUseType: null,
    regionClimateZone: null,
    avgRainfallMm: null,
    rainfallDescriptor: null,
    avgTempC: null,
    speciesRichnessCount: null,
    habitatDiversityIndex: null,
    pollutionLevel: null,
    deforestationRatePct: null,
    latitude: null,
    longitude: null,
    lastUpdated: new Date(),
  };
}

function rowToProfile(row: typeof siteProfiles.$inferSelect): SiteProfileData {
  return {
    sessionId: row.sessionId,
    soilPh: row.soilPh,
    soilOrganicCarbonPct: row.soilOrganicCarbonPct,
    soilMoisturePct: row.soilMoisturePct,
    landUseType: row.landUseType,
    regionClimateZone: row.regionClimateZone,
    avgRainfallMm: row.avgRainfallMm,
    rainfallDescriptor: row.rainfallDescriptor,
    avgTempC: row.avgTempC,
    speciesRichnessCount: row.speciesRichnessCount,
    habitatDiversityIndex: row.habitatDiversityIndex,
    pollutionLevel: row.pollutionLevel,
    deforestationRatePct: row.deforestationRatePct,
    latitude: row.latitude,
    longitude: row.longitude,
    lastUpdated: row.lastUpdated,
  };
}

export async function getOrCreateProfile(sessionId: string): Promise<SiteProfileData> {
  try {
    const existing = await db.select().from(siteProfiles).where(eq(siteProfiles.sessionId, sessionId));
    if (existing.length) return rowToProfile(existing[0]);

    const inserted = await db
      .insert(siteProfiles)
      .values({ sessionId })
      .onConflictDoNothing({ target: siteProfiles.sessionId })
      .returning();

    if (inserted.length) return rowToProfile(inserted[0]);

    const row = await db.select().from(siteProfiles).where(eq(siteProfiles.sessionId, sessionId));
    if (row.length) return rowToProfile(row[0]);
  } catch {
    // Fallback to in-memory
  }

  if (!inMemoryProfiles.has(sessionId)) {
    inMemoryProfiles.set(sessionId, defaultProfile(sessionId));
  }
  return inMemoryProfiles.get(sessionId)!;
}

export async function updateProfile(sessionId: string, patch: ExtractedFields): Promise<SiteProfileData> {
  const current = await getOrCreateProfile(sessionId);

  const dbPatch: Record<string, unknown> = {};
  const map: Record<string, string> = {
    soilPh: "soilPh",
    soilOrganicCarbonPct: "soilOrganicCarbonPct",
    soilMoisturePct: "soilMoisturePct",
    landUseType: "landUseType",
    regionClimateZone: "regionClimateZone",
    avgRainfallMm: "avgRainfallMm",
    rainfallDescriptor: "rainfallDescriptor",
    avgTempC: "avgTempC",
    speciesRichnessCount: "speciesRichnessCount",
    habitatDiversityIndex: "habitatDiversityIndex",
    pollutionLevel: "pollutionLevel",
    deforestationRatePct: "deforestationRatePct",
    latitude: "latitude",
    longitude: "longitude",
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && value !== null && key in map) {
      dbPatch[map[key]] = value;
    }
  }

  if (Object.keys(dbPatch).length === 0) return current;

  dbPatch.lastUpdated = new Date();

  try {
    const updated = await db
      .update(siteProfiles)
      .set(dbPatch)
      .where(eq(siteProfiles.sessionId, sessionId))
      .returning();

    if (updated.length) return rowToProfile(updated[0]);
  } catch {
    // Fallback to in-memory
  }

  const merged: SiteProfileData = {
    ...current,
    ...dbPatch,
    lastUpdated: new Date(),
  };
  inMemoryProfiles.set(sessionId, merged);
  return merged;
}

export async function resetProfile(sessionId: string): Promise<void> {
  try {
    await db.delete(siteProfiles).where(eq(siteProfiles.sessionId, sessionId));
    await db.insert(siteProfiles).values({ sessionId }).onConflictDoNothing();
  } catch {
    // Fallback
  }
  inMemoryProfiles.set(sessionId, defaultProfile(sessionId));
  inMemoryMessages.delete(sessionId);
}

export async function getOrCreateConversation(sessionId: string): Promise<string> {
  try {
    const existing = await db.select().from(conversations).where(eq(conversations.sessionId, sessionId));
    if (existing.length) return existing[0].id;
    const inserted = await db.insert(conversations).values({ sessionId }).returning();
    return inserted[0].id;
  } catch {
    return sessionId;
  }
}

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string,
  extractedEntities?: unknown,
): Promise<void> {
  try {
    const conversationId = await getOrCreateConversation(sessionId);
    await db.insert(messages).values({
      conversationId,
      sessionId,
      role,
      content,
      extractedEntities: extractedEntities ?? null,
    });
  } catch {
    // In-memory fallback
    const list = inMemoryMessages.get(sessionId) ?? [];
    list.push({ role, content, timestamp: new Date(), extractedEntities });
    inMemoryMessages.set(sessionId, list);
  }
}

export async function getHistory(sessionId: string) {
  try {
    const res = await db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(messages.timestamp);
    if (res && res.length) return res;
  } catch {
    // Fallback
  }
  return (inMemoryMessages.get(sessionId) ?? []).map((m, idx) => ({
    id: `mem-${idx}`,
    sessionId,
    role: m.role,
    content: m.content,
    extractedEntities: m.extractedEntities ?? null,
    timestamp: m.timestamp,
  }));
}

export async function logRecommendation(
  sessionId: string,
  recommendationText: string,
  metricsTargeted: unknown,
  confidenceScore: number,
  timeHorizon: string,
  sourceCitations: unknown,
): Promise<void> {
  try {
    await db.insert(recommendationsLog).values({
      sessionId,
      recommendationText,
      metricsTargeted,
      confidenceScore,
      timeHorizon,
      sourceCitations,
    });
  } catch {
    // No-op fallback
  }
}

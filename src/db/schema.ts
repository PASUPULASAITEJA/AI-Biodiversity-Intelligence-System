// Drizzle ORM schema for the Darukaa Biodiversity Intelligence System.
// Tables cover: conversation memory, extracted site profiles (state layer),
// the RAG knowledge chunk store, and the recommendations audit log.
import {
  pgTable,
  uuid,
  text,
  timestamp,
  doublePrecision,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id, {
    onDelete: "cascade",
  }),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  extractedEntities: jsonb("extracted_entities"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export const siteProfiles = pgTable("site_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull().unique(),

  soilPh: doublePrecision("soil_ph"),
  soilOrganicCarbonPct: doublePrecision("soil_organic_carbon_pct"),
  soilMoisturePct: doublePrecision("soil_moisture_pct"),

  landUseType: text("land_use_type"),
  regionClimateZone: text("region_climate_zone"),

  avgRainfallMm: doublePrecision("avg_rainfall_mm"),
  rainfallDescriptor: text("rainfall_descriptor"),
  avgTempC: doublePrecision("avg_temp_c"),

  speciesRichnessCount: integer("species_richness_count"),
  habitatDiversityIndex: doublePrecision("habitat_diversity_index"),

  pollutionLevel: text("pollution_level"),
  deforestationRatePct: doublePrecision("deforestation_rate_pct"),

  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),

  lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow().notNull(),
});

export const recommendationsLog = pgTable("recommendations_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull(),
  recommendationText: text("recommendation_text").notNull(),
  metricsTargeted: jsonb("metrics_targeted"),
  confidenceScore: doublePrecision("confidence_score"),
  timeHorizon: text("time_horizon"),
  sourceCitations: jsonb("source_citations"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Local "vector store" — knowledge base chunks ingested from /knowledge_base
// with a lexical TF-IDF embedding vector stored as jsonb for cosine-similarity
// retrieval (see src/lib/rag/*). Acts as our ChromaDB-equivalent inside Postgres.
export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey(),
  category: text("category").notNull(),
  topic: text("topic").notNull(),
  content: text("content").notNull(),
  metricsAffected: jsonb("metrics_affected"),
  source: text("source"),
  sourceUrl: text("source_url"),
  confidence: text("confidence"),
  quantitativeImpact: text("quantitative_impact"),
  applicableConditions: jsonb("applicable_conditions"),
  embedding: jsonb("embedding").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

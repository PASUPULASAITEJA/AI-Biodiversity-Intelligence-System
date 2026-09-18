// Shared types for the Darukaa Biodiversity Intelligence System.

export type Confidence = "high" | "medium" | "low";

export interface KnowledgeEntry {
  id: string;
  category: "soil" | "land_use" | "biodiversity" | "climate" | "human_impact";
  topic: string;
  content: string;
  metrics_affected: string[];
  source: string;
  source_url: string;
  confidence: Confidence;
  quantitative_impact: string;
  applicable_conditions: {
    climate: string[];
    land_use: string[];
  };
}

export interface RetrievedChunk extends KnowledgeEntry {
  similarity: number;
}

export interface SiteProfileData {
  sessionId: string;
  soilPh: number | null;
  soilOrganicCarbonPct: number | null;
  soilMoisturePct: number | null;
  landUseType: string | null;
  regionClimateZone: string | null;
  avgRainfallMm: number | null;
  rainfallDescriptor: string | null;
  avgTempC: number | null;
  speciesRichnessCount: number | null;
  habitatDiversityIndex: number | null;
  pollutionLevel: string | null;
  deforestationRatePct: number | null;
  latitude: number | null;
  longitude: number | null;
  lastUpdated?: Date;
}

export const CRITICAL_FIELDS: (keyof SiteProfileData)[] = [
  "soilOrganicCarbonPct",
  "regionClimateZone",
  "landUseType",
  "avgRainfallMm",
];

export interface RecommendationItem {
  action: string;
  scientific_reasoning: string;
  metrics_impacted: Record<string, string>;
  time_horizon: string;
  confidence: Confidence;
  source: string;
  connects_variables: string[];
}

export interface StructuredRecommendationOutput {
  recommendations: RecommendationItem[];
  cross_variable_analysis: string;
  follow_up_question: string;
}

export interface ReasoningLogStep {
  step: string;
  content: string;
}

export interface ChatTurnResult {
  sessionId: string;
  type: "clarifying_question" | "recommendation";
  missingFields?: string[];
  message: string;
  retrievedKnowledge?: { source: string; category: string; similarity: number; topic: string }[];
  reasoningLog?: ReasoningLogStep[];
  structuredOutput?: StructuredRecommendationOutput;
  profile: SiteProfileData;
}

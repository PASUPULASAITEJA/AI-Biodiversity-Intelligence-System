import type {
  ChatTurnResult,
  RecommendationItem,
  ReasoningLogStep,
  RetrievedChunk,
  SiteProfileData,
  StructuredRecommendationOutput,
} from "./types";
import { CRITICAL_FIELDS } from "./types";
import { extractFromStructured, extractFromText, mergeExtracted, type ExtractedFields } from "./entityExtraction";
import { getOrCreateProfile, updateProfile, saveMessage, logRecommendation } from "./profileStore";
import { searchKnowledge } from "./rag/retrieval";
import { buildDominantChain, formatChain, RELATIONSHIPS } from "./relationshipGraph";
import { llmExtractEntities, llmEnhanceNarrative, llmAvailable } from "./llm";

export interface ChatInput {
  sessionId: string;
  message?: string;
  structured?: Record<string, unknown>;
}

// ---------------------------------------------------------------------
// STEP 2 — Completeness check
// ---------------------------------------------------------------------
export function checkMissingCriticalFields(profile: SiteProfileData): string[] {
  return CRITICAL_FIELDS.filter((f) => profile[f] === null || profile[f] === undefined);
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    soilOrganicCarbonPct: "soil organic carbon % (SOC)",
    regionClimateZone: "your region's climate zone (e.g. semi-arid, arid, tropical, temperate)",
    landUseType: "current land use type (e.g. monoculture wheat, agroforestry, grassland)",
    avgRainfallMm: "your region's rainfall pattern (low / medium / high, or mm/year)",
  };
  return labels[field] ?? field;
}

function isLow(profile: SiteProfileData): { socLow: boolean; rainfallLow: boolean; monoculture: boolean; dryClimate: boolean } {
  const socLow = profile.soilOrganicCarbonPct != null && profile.soilOrganicCarbonPct < 1.0;
  const rainfallLow =
    profile.rainfallDescriptor === "low" || (profile.avgRainfallMm != null && profile.avgRainfallMm < 400);
  const monoculture = Boolean(profile.landUseType && profile.landUseType.includes("monoculture"));
  const dryClimate = Boolean(
    profile.regionClimateZone && ["semi-arid", "arid"].includes(profile.regionClimateZone),
  );
  return { socLow, rainfallLow, monoculture, dryClimate };
}

function buildRetrievalQuery(profile: SiteProfileData): string {
  const parts = [
    profile.landUseType ? `land use: ${profile.landUseType.replace(/_/g, " ")}` : "",
    profile.regionClimateZone ? `climate zone: ${profile.regionClimateZone}` : "",
    profile.soilOrganicCarbonPct != null ? `soil organic carbon ${profile.soilOrganicCarbonPct}%` : "",
    profile.rainfallDescriptor ? `rainfall: ${profile.rainfallDescriptor}` : "",
    "biodiversity decline species richness water retention intercropping agroforestry cover cropping recommendation",
  ];
  return parts.filter(Boolean).join(", ");
}

function pickTop(chunks: RetrievedChunk[], category: string): RetrievedChunk | undefined {
  return chunks.filter((c) => c.category === category).sort((a, b) => b.similarity - a.similarity)[0];
}

// ---------------------------------------------------------------------
// STEP 4 — Chain-of-thought reasoning (logged, not shown verbatim to user)
// ---------------------------------------------------------------------
function buildReasoningLog(
  profile: SiteProfileData,
  chain: string[],
  retrieved: RetrievedChunk[],
): ReasoningLogStep[] {
  const soilChunk = pickTop(retrieved, "soil");
  const bioChunk = pickTop(retrieved, "biodiversity");
  const landChunk = pickTop(retrieved, "land_use");
  const climateChunk = pickTop(retrieved, "climate");

  const flags = isLow(profile);

  return [
    {
      step: "1. Soil-biodiversity linkage",
      content: soilChunk
        ? `${soilChunk.content} (source: ${soilChunk.source})`
        : "No direct soil-biodiversity chunk retrieved; relying on relationship graph edge soil_organic_carbon → microbial_diversity → species_richness.",
    },
    {
      step: "2. Water-species survival linkage",
      content: climateChunk
        ? `${climateChunk.content} (source: ${climateChunk.source})`
        : "Rainfall and water retention jointly constrain species survival via soil_moisture_pct (relationship graph: rainfall → soil_moisture_pct → species_survival).",
    },
    {
      step: "3. Land-use fragmentation issue",
      content: landChunk
        ? `${landChunk.content} (source: ${landChunk.source})`
        : "Reduced land_use_diversity increases habitat_fragmentation, which suppresses species_richness (relationship graph).",
    },
    {
      step: "4. Root cause synthesis",
      content: `Given SOC=${profile.soilOrganicCarbonPct ?? "unknown"}%, rainfall=${
        profile.rainfallDescriptor ?? profile.avgRainfallMm ?? "unknown"
      }, land_use=${profile.landUseType ?? "unknown"}, region=${profile.regionClimateZone ?? "unknown"}: ${
        flags.monoculture ? "structural land-use simplification (monoculture)" : "land-use/soil condition"
      } is the upstream driver that compounds with ${
        flags.socLow ? "critically low soil organic carbon" : "soil condition"
      } and ${flags.rainfallLow ? "low/variable rainfall" : "rainfall variability"} to suppress water retention and, ultimately, species richness. Causal chain traversed (${chain.length - 1} hops): ${formatChain(chain)}.`,
    },
    {
      step: "5. Non-obvious intervention",
      content: bioChunk
        ? `${bioChunk.content} (source: ${bioChunk.source}) — addressing the upstream driver (${chain[0]}) rather than only the symptom (${chain[chain.length - 1]}) breaks the negative feedback loop.`
        : `Intervening on ${chain[0]} (upstream) rather than ${chain[chain.length - 1]} (downstream symptom) is expected to break the compounding negative feedback loop.`,
    },
  ];
}

// ---------------------------------------------------------------------
// STEP 5 — Structured output generation
// ---------------------------------------------------------------------
function buildStructuredOutput(
  profile: SiteProfileData,
  retrieved: RetrievedChunk[],
  chain: string[],
): StructuredRecommendationOutput {
  const flags = isLow(profile);
  const recommendations: RecommendationItem[] = [];

  const landChunk = pickTop(retrieved, "land_use");
  const soilChunk = pickTop(retrieved, "soil") ?? retrieved.find((c) => c.topic.includes("nitrogen_fixation"));
  const climateChunk = pickTop(retrieved, "climate");
  const bioChunk = pickTop(retrieved, "biodiversity");
  const humanChunk = pickTop(retrieved, "human_impact");

  // Recommendation 1: land-use diversification (agroforestry / legume intercropping)
  if (flags.monoculture || !profile.landUseType || flags.socLow) {
    const action = flags.dryClimate
      ? "Introduce legume-based intercropping / agroforestry (e.g., Gliricidia sepium, Faidherbia albida, or cowpea intercropped with wheat)"
      : "Diversify the cropping system via intercropping or rotational agroforestry";
    const reasoning = `Legumes fix atmospheric nitrogen via rhizobia symbiosis, increasing soil organic carbon and microbial biomass (relationship graph: land_use_diversity → soil_organic_carbon). ${
      soilChunk ? soilChunk.content : ""
    } In ${profile.regionClimateZone ?? "this"} zones, added canopy/root structure also creates microclimate buffering that reduces evapotranspiration stress on adjacent crops (soil_organic_carbon → water_retention), which in turn improves habitat quality for pollinators and soil fauna (water_retention → species_richness). This recommendation traverses the causal chain: ${formatChain(chain)}.`;
    recommendations.push({
      action,
      scientific_reasoning: reasoning,
      metrics_impacted: {
        soil_organic_carbon_pct: soilChunk?.quantitative_impact || "+15-25% over 2-3 years",
        species_richness: landChunk?.quantitative_impact || "+10-30% (pollinator & soil fauna)",
        water_retention: "improved by 12-18% via microclimate buffering and reduced evapotranspiration",
      },
      time_horizon: "medium-term (2-3 years)",
      confidence: "high",
      source: [soilChunk?.source, landChunk?.source].filter(Boolean).join("; ") || "FAO 2021 Conservation Agriculture Report",
      connects_variables: chain,
    });
  }

  // Recommendation 2: water management, if rainfall/soil moisture is a limiting stressor
  if (flags.rainfallLow || flags.dryClimate) {
    const waterChunk =
      retrieved.find((c) => c.topic.includes("water_harvesting")) ??
      retrieved.find((c) => c.topic.includes("soil_structure_water_infiltration")) ??
      climateChunk;
    recommendations.push({
      action:
        "Install low-cost water-harvesting micro-catchments (contour bunds / half-moon "
        + "zai pits) combined with drought-tolerant cover cropping",
      scientific_reasoning: `Degraded, low-SOC soils infiltrate up to 30% less rainfall (Rawls et al.), so most rain is lost as runoff instead of recharging the root zone (relationship graph: rainfall → water_retention → soil_moisture_pct). Water-harvesting structures capture and concentrate this runoff directly into the root zone, while cover crops reduce bare-soil evaporation. ${
        waterChunk ? waterChunk.content : ""
      }`,
      metrics_impacted: {
        soil_moisture_pct: waterChunk?.quantitative_impact || "+20-40% plant-available soil moisture",
        water_retention: "improved by 12-18%",
        species_richness: "indirect gains via improved vegetation cover for pollinators and soil fauna",
      },
      time_horizon: "short-to-medium-term (1-2 years)",
      confidence: waterChunk?.confidence ?? "medium",
      source: waterChunk?.source || "FAO 2021 Water Harvesting Techniques for Dryland Agriculture",
      connects_variables: ["rainfall", "water_retention", "soil_moisture_pct", "species_richness"],
    });
  }

  // Recommendation 3: biodiversity-support layer (field margins / riparian buffer), always useful
  if (bioChunk || humanChunk) {
    const chunk = bioChunk ?? humanChunk!;
    recommendations.push({
      action: "Establish flowering field margins / riparian buffer strips along field edges and waterways",
      scientific_reasoning: `${chunk.content} This directly targets land_use_diversity → habitat_fragmentation → species_richness, complementing the soil- and water-focused interventions above by restoring landscape-scale habitat connectivity.`,
      metrics_impacted: {
        species_richness: chunk.quantitative_impact || "+20-45% pollinator visitation",
        habitat_diversity_index: "improved landscape structural complexity",
      },
      time_horizon: "short-term (1-2 growing seasons)",
      confidence: chunk.confidence,
      source: chunk.source,
      connects_variables: ["land_use_diversity", "habitat_fragmentation", "species_richness"],
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      action: "Establish a baseline biodiversity and soil monitoring program",
      scientific_reasoning:
        "Insufficient contrast in the current profile to prescribe a targeted intervention beyond monitoring. Tracking Shannon diversity index, SOC and rainfall over 1-2 seasons will sharpen future recommendations.",
      metrics_impacted: { habitat_diversity_index: "establishes baseline for future comparison" },
      time_horizon: "short-term (1 season)",
      confidence: "medium",
      source: "CBD Global Biodiversity Framework (2022) Monitoring Framework Indicators",
      connects_variables: chain,
    });
  }

  const socNote = flags.socLow
    ? `Your low soil organic carbon (${profile.soilOrganicCarbonPct}%) degrades soil structure, reducing water infiltration by up to 30% (Rawls et al.), `
    : "Your current soil condition ";
  const rainNote = flags.rainfallLow ? "combined with low/variable rainfall " : "";
  const cross_variable_analysis = `${socNote}${rainNote}creates a compounding stress loop: degraded soil limits how much rainfall becomes usable soil moisture, which further limits vegetation cover, which reduces habitat complexity for pollinators and soil fauna — a negative feedback loop. Breaking this loop requires intervening upstream, along the causal chain ${formatChain(
    chain,
  )}, rather than treating any single metric in isolation.`;

  const follow_up_question = flags.rainfallLow
    ? "Do you have data on current pollinator activity or visible erosion patterns (rills, gullies, exposed subsoil)? This would help refine irrigation-linked and erosion-control recommendations."
    : "Can you share recent species richness counts or any visible signs of habitat fragmentation (isolated tree patches, field size)? This would help prioritize between soil- and habitat-focused interventions.";

  return { recommendations, cross_variable_analysis, follow_up_question };
}

function renderChatMarkdown(structured: StructuredRecommendationOutput): string {
  const parts: string[] = [];
  structured.recommendations.forEach((rec, i) => {
    parts.push(`### ${i + 1}. 📋 Recommendation\n${rec.action}`);
    parts.push(`**🔬 Why It Works**\n${rec.scientific_reasoning}`);
    const metrics = Object.entries(rec.metrics_impacted)
      .map(([k, v]) => `- **${k}**: ${v}`)
      .join("\n");
    parts.push(`**📊 Metrics Impacted**\n${metrics}`);
    parts.push(`**⏱️ Timeline**: ${rec.time_horizon}`);
    parts.push(`**✅ Confidence**: ${rec.confidence}`);
    parts.push(`**📚 Source**: ${rec.source}`);
    parts.push(`_Connects: ${rec.connects_variables.join(" → ")}_`);
    parts.push("---");
  });
  parts.push(`### 🔄 Cross-Variable Analysis\n${structured.cross_variable_analysis}`);
  parts.push(`### ❓ Follow-up\n${structured.follow_up_question}`);
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------
// Main orchestration entry point (STEP 1 → STEP 6)
// ---------------------------------------------------------------------
export async function runChatTurn(input: ChatInput): Promise<ChatTurnResult> {
  const { sessionId } = input;

  // STEP 1 — Entity extraction (structured + free text + optional LLM augmentation)
  const structuredExtracted = input.structured ? extractFromStructured(input.structured) : {};
  const textExtracted = input.message ? extractFromText(input.message) : {};

  let llmExtracted: ExtractedFields = {};
  if (input.message && llmAvailable()) {
    const raw = await llmExtractEntities(input.message);
    if (raw) llmExtracted = extractFromStructured(raw);
  }

  // Structured input takes precedence over free text, which takes precedence over LLM guesses.
  const merged = mergeExtracted(llmExtracted, textExtracted, structuredExtracted);

  const rawMessageForLog = input.message ?? JSON.stringify(input.structured ?? {});
  await saveMessage(sessionId, "user", rawMessageForLog, merged);

  const profile = Object.keys(merged).length ? await updateProfile(sessionId, merged) : await getOrCreateProfile(sessionId);

  // STEP 2 — Completeness check
  const missing = checkMissingCriticalFields(profile);
  if (missing.length >= 2) {
    const askedLabels = missing.map(fieldLabel);
    const message = `To give you accurate recommendations, I need a bit more information: ${askedLabels.join(
      "; ",
    )}. Can you share these?`;
    await saveMessage(sessionId, "assistant", message);
    return {
      sessionId,
      type: "clarifying_question",
      missingFields: missing,
      message,
      profile,
    };
  }

  // STEP 3 — Multi-metric retrieval (forced category diversity)
  const query = buildRetrievalQuery(profile);
  const retrieved = await searchKnowledge(query, {
    climate: profile.regionClimateZone,
    landUse: profile.landUseType,
    k: 7,
  });

  // Relationship-graph-driven causal chain (>= 2 hops)
  const flags = isLow(profile);
  const stressedMetrics = [
    flags.socLow ? "soil_organic_carbon" : null,
    flags.rainfallLow ? "rainfall" : null,
    flags.monoculture ? "land_use_diversity" : null,
    "water_retention",
    "species_richness",
  ].filter((v): v is string => Boolean(v));
  const preferredStart = flags.monoculture
    ? "land_use_diversity"
    : flags.socLow
      ? "soil_organic_carbon"
      : "rainfall";
  const chain = buildDominantChain(stressedMetrics, preferredStart, "species_richness");

  // STEP 4 — Chain-of-thought reasoning (logged server-side + returned for transparency/debugging)
  const reasoningLog = buildReasoningLog(profile, chain, retrieved);
  console.log("[reasoning-chain]", JSON.stringify(reasoningLog, null, 2));
  console.log("[relationship-graph-traversal]", formatChain(chain), "hops:", chain.length - 1);

  // STEP 5 — Structured output generation
  const structuredOutput = buildStructuredOutput(profile, retrieved, chain);

  // Optional LLM narrative polish (best-effort; falls back silently)
  if (llmAvailable()) {
    const enhanced = await llmEnhanceNarrative(
      JSON.stringify(profile),
      formatChain(chain),
      structuredOutput.cross_variable_analysis,
    );
    if (enhanced) structuredOutput.cross_variable_analysis = enhanced;
  }

  for (const rec of structuredOutput.recommendations) {
    await logRecommendation(
      sessionId,
      rec.action,
      rec.metrics_impacted,
      rec.confidence === "high" ? 0.9 : rec.confidence === "medium" ? 0.65 : 0.4,
      rec.time_horizon,
      { source: rec.source, connects_variables: rec.connects_variables },
    );
  }

  // STEP 6 — Render clean chat response
  const message = renderChatMarkdown(structuredOutput);
  await saveMessage(sessionId, "assistant", message, { structuredOutput });

  return {
    sessionId,
    type: "recommendation",
    message,
    retrievedKnowledge: retrieved.map((r) => ({
      source: r.source,
      category: r.category,
      similarity: r.similarity,
      topic: r.topic,
    })),
    reasoningLog,
    structuredOutput,
    profile,
  };
}

export function graphMetricCount(): number {
  return Object.keys(RELATIONSHIPS).length;
}

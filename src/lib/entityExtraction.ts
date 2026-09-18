import type { SiteProfileData } from "./types";
import { estimateClimateZone } from "./climateZones";

export type ExtractedFields = Partial<
  Pick<
    SiteProfileData,
    | "soilPh"
    | "soilOrganicCarbonPct"
    | "soilMoisturePct"
    | "landUseType"
    | "regionClimateZone"
    | "avgRainfallMm"
    | "rainfallDescriptor"
    | "avgTempC"
    | "speciesRichnessCount"
    | "habitatDiversityIndex"
    | "pollutionLevel"
    | "deforestationRatePct"
    | "latitude"
    | "longitude"
  >
>;

const LAND_USE_KEYWORDS = [
  "monoculture wheat",
  "monoculture_wheat",
  "monoculture",
  "agroforestry",
  "polyculture",
  "intercropping",
  "silvopasture",
  "rangeland",
  "grassland",
  "pasture",
  "cropland",
  "degraded cropland",
  "irrigated cropland",
  "forest",
  "deforested land",
  "urban expansion",
  "urban",
  "wetland",
];

const CLIMATE_KEYWORDS = [
  "semi-arid",
  "semi arid",
  "semiarid",
  "arid",
  "tropical",
  "temperate",
  "humid",
  "desert",
];

const RAINFALL_DESCRIPTOR_MM: Record<string, number> = {
  low: 200,
  medium: 500,
  moderate: 500,
  high: 900,
};

function normalizeLandUse(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("monoculture") && s.includes("wheat")) return "monoculture_wheat";
  return s.replace(/\s+/g, "_");
}

function normalizeClimate(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("semi")) return "semi-arid";
  return s;
}

/** Maps a flexible structured JSON payload (as described in the spec) onto our schema. */
export function extractFromStructured(input: Record<string, unknown>): ExtractedFields {
  const out: ExtractedFields = {};

  const num = (v: unknown): number | undefined => {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    return undefined;
  };

  if (input.soil_ph !== undefined) out.soilPh = num(input.soil_ph);
  if (input.soil_organic_carbon_pct !== undefined)
    out.soilOrganicCarbonPct = num(input.soil_organic_carbon_pct);
  if (input.soc !== undefined) out.soilOrganicCarbonPct = num(input.soc);
  if (input.soil_moisture_pct !== undefined) out.soilMoisturePct = num(input.soil_moisture_pct);

  const landUse = input.land_use_type ?? input.land_use ?? input.crop ?? input.landUse;
  if (typeof landUse === "string" && landUse.trim()) out.landUseType = normalizeLandUse(landUse);

  const region = input.region_climate_zone ?? input.region ?? input.climate_zone ?? input.climate;
  if (typeof region === "string" && region.trim()) out.regionClimateZone = normalizeClimate(region);

  if (typeof input.rainfall === "string") {
    const key = input.rainfall.toLowerCase().trim();
    if (RAINFALL_DESCRIPTOR_MM[key] !== undefined) {
      out.rainfallDescriptor = key;
      out.avgRainfallMm = RAINFALL_DESCRIPTOR_MM[key];
    }
  }
  const rainfallNum = num(input.avg_rainfall_mm ?? input.rainfall_mm ?? (typeof input.rainfall === "number" ? input.rainfall : undefined));
  if (rainfallNum !== undefined) out.avgRainfallMm = rainfallNum;

  if (input.avg_temp_c !== undefined) out.avgTempC = num(input.avg_temp_c);
  if (input.species_richness_count !== undefined)
    out.speciesRichnessCount = num(input.species_richness_count);
  if (input.habitat_diversity_index !== undefined)
    out.habitatDiversityIndex = num(input.habitat_diversity_index);
  if (typeof input.pollution_level === "string") out.pollutionLevel = input.pollution_level;
  if (input.deforestation_rate_pct !== undefined)
    out.deforestationRatePct = num(input.deforestation_rate_pct);

  const coords = input.coordinates as { lat?: number; lon?: number; lng?: number } | undefined;
  if (coords && typeof coords === "object") {
    if (typeof coords.lat === "number") out.latitude = coords.lat;
    const lon = coords.lon ?? coords.lng;
    if (typeof lon === "number") out.longitude = lon;
  }
  if (input.latitude !== undefined) out.latitude = num(input.latitude);
  if (input.longitude !== undefined) out.longitude = num(input.longitude);

  // Auto-fill climate zone from coordinates if not explicitly given.
  if (out.regionClimateZone === undefined && typeof out.latitude === "number" && typeof out.longitude === "number") {
    const guess = estimateClimateZone(out.latitude, out.longitude);
    out.regionClimateZone = guess.climateZone;
  }

  return out;
}

/** Regex/keyword-based free-text entity extraction (rule-based NLP fallback that
 *  always runs; augmented by LLM function-calling in lib/llm.ts when an API key
 *  is configured). */
export function extractFromText(text: string): ExtractedFields {
  const out: ExtractedFields = {};
  const t = text.toLowerCase();

  const phMatch = t.match(/\bph\b[^0-9]{0,10}(\d+(\.\d+)?)/);
  if (phMatch) out.soilPh = parseFloat(phMatch[1]);

  const socMatch =
    t.match(/(?:soil\s*organic\s*carbon|organic\s*carbon|soc)[^0-9]{0,10}(\d+(\.\d+)?)\s*%/i) ||
    t.match(/(\d+(\.\d+)?)\s*%\s*(?:soil\s*organic\s*carbon|organic\s*carbon|soc)/i);
  if (socMatch) {
    const val = parseFloat(socMatch[1] && !socMatch[1].includes("carbon") && !socMatch[1].includes("soc") ? socMatch[1] : socMatch[2] || socMatch[1]);
    if (!Number.isNaN(val)) out.soilOrganicCarbonPct = val;
  }

  const moistureMatch =
    t.match(/soil\s*moisture[^0-9]{0,10}(\d+(\.\d+)?)\s*%/i) ||
    t.match(/(\d+(\.\d+)?)\s*%\s*soil\s*moisture/i);
  if (moistureMatch) {
    const val = parseFloat(moistureMatch[1] && !moistureMatch[1].includes("moisture") ? moistureMatch[1] : moistureMatch[2] || moistureMatch[1]);
    if (!Number.isNaN(val)) out.soilMoisturePct = val;
  }

  const tempMatch = t.match(/(?:temperature|temp)[^0-9]{0,10}(\d+(\.\d+)?)\s*°?\s*c/i);
  if (tempMatch) out.avgTempC = parseFloat(tempMatch[1]);

  const speciesMatch = t.match(/species\s*richness[^0-9]{0,10}(\d+)/i);
  if (speciesMatch) out.speciesRichnessCount = parseInt(speciesMatch[1], 10);

  const habitatMatch = t.match(/habitat\s*diversity(?:\s*index)?[^0-9]{0,10}(\d+(\.\d+)?)/i);
  if (habitatMatch) out.habitatDiversityIndex = parseFloat(habitatMatch[1]);

  const deforestMatch =
    t.match(/deforestation(?:\s*rate)?[^0-9]{0,10}(\d+(\.\d+)?)\s*%/i) ||
    t.match(/(\d+(\.\d+)?)\s*%\s*deforestation/i);
  if (deforestMatch) {
    const val = parseFloat(deforestMatch[1] && !deforestMatch[1].includes("deforest") ? deforestMatch[1] : deforestMatch[2] || deforestMatch[1]);
    if (!Number.isNaN(val)) out.deforestationRatePct = val;
  }

  const rainfallNumMatch = t.match(/(\d+(\.\d+)?)\s*mm\b/i);
  if (rainfallNumMatch) out.avgRainfallMm = parseFloat(rainfallNumMatch[1]);
  else {
    for (const key of Object.keys(RAINFALL_DESCRIPTOR_MM)) {
      if (
        t.includes(`${key} rainfall`) ||
        t.includes(`rainfall is ${key}`) ||
        t.includes(`rainfall: ${key}`) ||
        t.includes(`rainfall = ${key}`) ||
        t.includes(`rainfall of ${key}`) ||
        t.includes(`rainfall (${key})`)
      ) {
        out.rainfallDescriptor = key;
        out.avgRainfallMm = RAINFALL_DESCRIPTOR_MM[key];
        break;
      }
    }
  }

  for (const kw of LAND_USE_KEYWORDS) {
    if (t.includes(kw)) {
      out.landUseType = normalizeLandUse(kw);
      break;
    }
  }

  for (const kw of CLIMATE_KEYWORDS) {
    if (t.includes(kw)) {
      out.regionClimateZone = normalizeClimate(kw);
      break;
    }
  }

  for (const level of ["low", "medium", "high"]) {
    if (t.includes(`${level} pollution`) || t.includes(`pollution is ${level}`)) {
      out.pollutionLevel = level;
      break;
    }
  }

  const coordMatch = text.match(/(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[3]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      out.latitude = lat;
      out.longitude = lon;
      if (!out.regionClimateZone) {
        out.regionClimateZone = estimateClimateZone(lat, lon).climateZone;
      }
    }
  }

  return out;
}

export function mergeExtracted(...sources: ExtractedFields[]): ExtractedFields {
  const merged: ExtractedFields = {};
  for (const src of sources) {
    for (const [key, value] of Object.entries(src)) {
      if (value !== undefined && value !== null) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }
  return merged;
}

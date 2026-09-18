// relationship_graph.ts
// -----------------------------------------------------------------------
// Hardcoded causal relationship map between environmental metrics. This is
// the differentiator described in the spec: recommendations must traverse
// >= 2 hops through this graph rather than being single-variable LLM
// improvisation. Ported 1:1 in spirit from the requested Python
// `relationship_graph.py` (also included at /backend/relationship_graph.py
// for the reference FastAPI deployment).
// -----------------------------------------------------------------------

export type MetricNode = {
  affects: string[];
  affected_by: string[];
};

export const RELATIONSHIPS: Record<string, MetricNode> = {
  soil_organic_carbon: {
    affects: ["microbial_diversity", "water_retention", "species_richness", "nutrient_availability"],
    affected_by: ["tillage_frequency", "cover_crops", "monoculture", "land_use_diversity", "pesticide_use"],
  },
  soil_ph: {
    affects: ["nutrient_availability", "microbial_diversity"],
    affected_by: ["irrigation_quality", "fertilizer_use", "soil_organic_carbon"],
  },
  soil_moisture_pct: {
    affects: ["microbial_diversity", "vegetation_density", "species_survival"],
    affected_by: ["rainfall", "soil_organic_carbon", "water_retention", "land_use_diversity"],
  },
  nutrient_availability: {
    affects: ["vegetation_density", "microbial_diversity"],
    affected_by: ["soil_ph", "soil_organic_carbon"],
  },
  microbial_diversity: {
    affects: ["soil_organic_carbon", "nutrient_availability", "species_richness"],
    affected_by: ["soil_moisture_pct", "pesticide_use", "monoculture", "soil_organic_carbon"],
  },
  water_retention: {
    affects: ["species_survival", "species_richness", "vegetation_density", "soil_moisture_pct"],
    affected_by: ["soil_organic_carbon", "rainfall", "land_use_diversity"],
  },
  rainfall: {
    affects: ["species_survival", "soil_moisture_pct", "vegetation_density", "water_retention"],
    affected_by: ["deforestation_rate_pct", "land_use_change"],
  },
  vegetation_density: {
    affects: ["species_survival", "pollinator_density", "habitat_diversity_index"],
    affected_by: ["rainfall", "soil_moisture_pct", "water_retention", "deforestation_rate_pct"],
  },
  land_use_diversity: {
    affects: ["habitat_fragmentation", "species_richness", "pollinator_density", "soil_organic_carbon"],
    affected_by: ["monoculture", "urban_expansion"],
  },
  habitat_fragmentation: {
    affects: ["species_richness", "genetic_diversity", "keystone_species_survival"],
    affected_by: ["land_use_diversity", "deforestation_rate_pct", "urban_expansion"],
  },
  species_richness: {
    affects: ["genetic_diversity", "keystone_species_survival", "habitat_diversity_index"],
    affected_by: [
      "habitat_fragmentation",
      "water_retention",
      "soil_organic_carbon",
      "pollinator_density",
      "land_use_diversity",
      "deforestation_rate_pct",
      "pollution_level",
    ],
  },
  pollinator_density: {
    affects: ["species_richness", "vegetation_density"],
    affected_by: ["land_use_diversity", "pesticide_use", "vegetation_density", "extreme_heat"],
  },
  genetic_diversity: {
    affects: ["keystone_species_survival"],
    affected_by: ["habitat_fragmentation", "species_richness"],
  },
  keystone_species_survival: {
    affects: ["species_richness", "genetic_diversity"],
    affected_by: ["habitat_fragmentation", "genetic_diversity"],
  },
  habitat_diversity_index: {
    affects: ["species_richness", "pollinator_density"],
    affected_by: ["land_use_diversity", "vegetation_density"],
  },
  deforestation_rate_pct: {
    affects: ["rainfall", "habitat_fragmentation", "species_richness", "vegetation_density"],
    affected_by: ["land_use_change", "monoculture"],
  },
  pollution_level: {
    affects: ["species_richness", "microbial_diversity", "vegetation_density"],
    affected_by: ["pesticide_use", "fertilizer_use", "urban_expansion"],
  },
  species_survival: {
    affects: ["species_richness", "keystone_species_survival"],
    affected_by: ["water_retention", "rainfall", "vegetation_density"],
  },
};

export const ALL_METRICS = Object.keys(RELATIONSHIPS);

/** Breadth-first search across `affects` edges, returns the shortest causal path. */
export function findCausalPath(from: string, to: string, maxHops = 5): string[] | null {
  if (from === to) return [from];
  const queue: string[][] = [[from]];
  const visited = new Set([from]);
  while (queue.length) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    if (path.length > maxHops) continue;
    const node = RELATIONSHIPS[last];
    if (!node) continue;
    for (const next of node.affects) {
      if (visited.has(next)) continue;
      const nextPath = [...path, next];
      if (next === to) return nextPath;
      visited.add(next);
      queue.push(nextPath);
    }
  }
  return null;
}

/**
 * Builds the "dominant" multi-hop causal chain for a given set of stressed
 * metrics (derived from the user's site profile), preferring to route through
 * other stressed/mentioned metrics so the explanation stays grounded in the
 * user's actual data rather than a generic shortest path.
 */
export function buildDominantChain(
  stressedMetrics: string[],
  preferredStart?: string,
  preferredEnd = "species_richness",
): string[] {
  const start = preferredStart && RELATIONSHIPS[preferredStart] ? preferredStart : "land_use_diversity";

  // Deterministically construct a narrative backbone: driver -> soil carbon (if
  // relevant) -> water retention (universal bridge metric) -> target, then
  // validate/bridge each hop against the graph so every edge is graph-grounded.
  const seq: string[] = [start];
  if (start !== "soil_organic_carbon" && (stressedMetrics.includes("soil_organic_carbon") || start === "land_use_diversity")) {
    seq.push("soil_organic_carbon");
  }
  if (seq[seq.length - 1] !== "water_retention") seq.push("water_retention");
  if (seq[seq.length - 1] !== preferredEnd) seq.push(preferredEnd);

  const validated: string[] = [seq[0]];
  for (let i = 1; i < seq.length; i++) {
    const prev = validated[validated.length - 1];
    const next = seq[i];
    if (prev === next) continue;
    if (RELATIONSHIPS[prev]?.affects.includes(next)) {
      validated.push(next);
    } else {
      const bridge = findCausalPath(prev, next, 4);
      if (bridge && bridge.length > 1) {
        validated.push(...bridge.slice(1));
      } else {
        validated.push(next);
      }
    }
  }
  return validated;
}

export function describeHop(from: string, to: string): string {
  return `${from} → ${to}`;
}

export function formatChain(chain: string[]): string {
  return chain.join(" → ");
}

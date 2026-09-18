// Optional LLM augmentation layer. When OPENAI_API_KEY is configured this
// calls GPT-4o-mini/GPT-4 with JSON mode to (a) extract additional entities
// from free text the regex layer might miss, and (b) rewrite the
// cross-variable narrative in more natural language. The system is fully
// functional without a key — every call here is best-effort and falls back
// silently so the deterministic rule/graph-based reasoning engine always
// produces a valid, spec-compliant response.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function hasKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function callChatJSON(system: string, user: string): Promise<Record<string, unknown> | null> {
  if (!hasKey()) return null;
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function llmExtractEntities(text: string): Promise<Record<string, unknown> | null> {
  const system = `You are an entity extraction function for an environmental science assistant.
Extract any of these fields mentioned in the user's message: soil_ph (number), soil_organic_carbon_pct (number),
soil_moisture_pct (number), land_use_type (string), region_climate_zone (one of: arid, semi-arid, tropical, temperate, humid),
avg_rainfall_mm (number), avg_temp_c (number), species_richness_count (integer), habitat_diversity_index (number),
pollution_level (low/medium/high), deforestation_rate_pct (number), latitude (number), longitude (number).
Return ONLY a JSON object with the fields you are confident about. Omit fields not mentioned.`;
  return callChatJSON(system, text);
}

export async function llmEnhanceNarrative(
  profileSummary: string,
  causalChain: string,
  ruleBasedAnalysis: string,
): Promise<string | null> {
  const system = `You are an environmental scientist writing a concise (3-4 sentence) cross-variable analysis
for a farmer/land manager. Ground your answer strictly in the provided causal chain and site data — do not invent
numbers not present in the input. Return JSON: {"analysis": "..."}`;
  const user = `Site profile: ${profileSummary}\nCausal chain: ${causalChain}\nDraft analysis to refine: ${ruleBasedAnalysis}`;
  const result = await callChatJSON(system, user);
  const analysis = result?.analysis;
  return typeof analysis === "string" ? analysis : null;
}

export function llmAvailable(): boolean {
  return hasKey();
}

"use client";

import { useEffect, useRef, useState } from "react";
import MarkdownLite from "@/components/MarkdownLite";
import type { ChatTurnResult, SiteProfileData } from "@/lib/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  retrievedKnowledge?: ChatTurnResult["retrievedKnowledge"];
  reasoningLog?: ChatTurnResult["reasoningLog"];
}

const PROFILE_FIELD_LABELS: [keyof SiteProfileData, string][] = [
  ["soilPh", "Soil pH"],
  ["soilOrganicCarbonPct", "Soil organic carbon %"],
  ["soilMoisturePct", "Soil moisture %"],
  ["landUseType", "Land use type"],
  ["regionClimateZone", "Climate zone"],
  ["avgRainfallMm", "Avg rainfall (mm)"],
  ["avgTempC", "Avg temperature (°C)"],
  ["speciesRichnessCount", "Species richness count"],
  ["habitatDiversityIndex", "Habitat diversity index"],
  ["pollutionLevel", "Pollution level"],
  ["deforestationRatePct", "Deforestation rate %"],
  ["latitude", "Latitude"],
  ["longitude", "Longitude"],
];

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "darukaa_session_id";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}

export default function HomePage() {
  const [sessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return getOrCreateSessionId();
    }
    return "";
  });
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<SiteProfileData | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showStructured, setShowStructured] = useState(false);
  const [structuredForm, setStructuredForm] = useState({
    soil_organic_carbon_pct: "",
    rainfall: "",
    land_use: "",
    region: "",
    soil_ph: "",
    lat: "",
    lon: "",
  });
  const [expandedDebug, setExpandedDebug] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      refreshProfile(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function refreshProfile(sid: string) {
    try {
      const res = await fetch(`/api/profile/${sid}`);
      const json = await res.json();
      setProfile(json.profile);
      setMissingFields(json.missingCriticalFields ?? []);
    } catch {
      // ignore
    }
  }

  function pushMessage(msg: DisplayMessage) {
    setMessages((prev) => [...prev, msg]);
  }

  async function handleResult(result: ChatTurnResult) {
    pushMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      text: result.message,
      retrievedKnowledge: result.retrievedKnowledge,
      reasoningLog: result.reasoningLog,
    });
    setProfile(result.profile);
    setMissingFields(result.missingFields ?? []);
  }

  async function sendFreeText() {
    if (!input.trim() || !sessionId) return;
    const text = input.trim();
    setInput("");
    pushMessage({ id: crypto.randomUUID(), role: "user", text });
    setLoading(true);
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const json = (await res.json()) as ChatTurnResult;
      await handleResult(json);
    } catch {
      pushMessage({ id: crypto.randomUUID(), role: "assistant", text: "⚠️ Something went wrong reaching the reasoning engine." });
    } finally {
      setLoading(false);
    }
  }

  async function sendStructured() {
    if (!sessionId) return;
    const payload: Record<string, unknown> = {};
    if (structuredForm.soil_organic_carbon_pct) payload.soil_organic_carbon_pct = Number(structuredForm.soil_organic_carbon_pct);
    if (structuredForm.rainfall) payload.rainfall = structuredForm.rainfall;
    if (structuredForm.land_use) payload.crop = structuredForm.land_use;
    if (structuredForm.region) payload.region = structuredForm.region;
    if (structuredForm.soil_ph) payload.soil_ph = Number(structuredForm.soil_ph);
    if (structuredForm.lat && structuredForm.lon) {
      payload.coordinates = { lat: Number(structuredForm.lat), lon: Number(structuredForm.lon) };
    }
    if (Object.keys(payload).length === 0) return;

    pushMessage({
      id: crypto.randomUUID(),
      role: "user",
      text: `📊 Structured input: ${JSON.stringify(payload)}`,
    });
    setLoading(true);
    try {
      const res = await fetch("/api/chat/structured-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      const json = (await res.json()) as ChatTurnResult;
      await handleResult(json);
      setShowStructured(false);
    } catch {
      pushMessage({ id: crypto.randomUUID(), role: "assistant", text: "⚠️ Something went wrong reaching the reasoning engine." });
    } finally {
      setLoading(false);
    }
  }

  async function handleResetProfile() {
    if (!sessionId) return;
    await fetch(`/api/profile/${sessionId}/reset`, { method: "POST" });
    setMessages([]);
    await refreshProfile(sessionId);
  }

  function loadTestScenario() {
    setStructuredForm({
      soil_organic_carbon_pct: "0.3",
      rainfall: "low",
      land_use: "monoculture wheat",
      region: "semi-arid",
      soil_ph: "",
      lat: "",
      lon: "",
    });
    setShowStructured(true);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50">
      <header className="border-b border-emerald-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-emerald-900">🌿 Darukaa Biodiversity Intelligence System</h1>
            <p className="text-sm text-slate-500">AI Environmental Scientist · RAG + causal-graph reasoning</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>session: {sessionId ? sessionId.slice(0, 8) : "…"}</div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[1fr_320px]">
        <section className="flex min-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
                <p className="font-medium">Try the canonical test scenario:</p>
                <p className="mt-1 text-slate-600">
                  SOC 0.3%, low rainfall, monoculture wheat, semi-arid region — or just describe your land in plain
                  text below (e.g. &quot;Biodiversity is declining on my land, semi-arid region&quot;).
                </p>
                <button
                  onClick={loadTestScenario}
                  className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Load test scenario into structured form
                </button>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2.5 text-sm text-white"
                      : "max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3"
                  }
                >
                  {m.role === "user" ? (
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  ) : (
                    <>
                      <MarkdownLite text={m.text} />
                      {(m.retrievedKnowledge?.length || m.reasoningLog?.length) && (
                        <div className="mt-3 border-t border-slate-200 pt-2">
                          <button
                            className="text-xs font-medium text-emerald-700 hover:underline"
                            onClick={() => setExpandedDebug((p) => ({ ...p, [m.id]: !p[m.id] }))}
                          >
                            {expandedDebug[m.id] ? "Hide" : "Show"} retrieval &amp; reasoning trace
                          </button>
                          {expandedDebug[m.id] && (
                            <div className="mt-2 space-y-2 text-xs text-slate-600">
                              {m.retrievedKnowledge?.length ? (
                                <div>
                                  <p className="font-semibold text-slate-700">Retrieved knowledge:</p>
                                  <ul className="mt-1 space-y-0.5">
                                    {m.retrievedKnowledge.map((r, i) => (
                                      <li key={i}>
                                        [source: {r.source}] [category: {r.category}] [similarity: {r.similarity.toFixed(2)}] — {r.topic}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {m.reasoningLog?.length ? (
                                <div>
                                  <p className="font-semibold text-slate-700">Chain-of-thought (hidden by default):</p>
                                  <ol className="mt-1 list-decimal space-y-1 pl-4">
                                    {m.reasoningLog.map((r, i) => (
                                      <li key={i}>
                                        <span className="font-medium">{r.step}:</span> {r.content}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs text-slate-400">Darukaa is reasoning…</div>}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 p-4">
            {showStructured && (
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-3">
                <input
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  placeholder="SOC % (e.g. 0.3)"
                  value={structuredForm.soil_organic_carbon_pct}
                  onChange={(e) => setStructuredForm((f) => ({ ...f, soil_organic_carbon_pct: e.target.value }))}
                />
                <select
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  value={structuredForm.rainfall}
                  onChange={(e) => setStructuredForm((f) => ({ ...f, rainfall: e.target.value }))}
                >
                  <option value="">Rainfall…</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  placeholder="Land use (e.g. monoculture wheat)"
                  value={structuredForm.land_use}
                  onChange={(e) => setStructuredForm((f) => ({ ...f, land_use: e.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  placeholder="Region (e.g. semi-arid)"
                  value={structuredForm.region}
                  onChange={(e) => setStructuredForm((f) => ({ ...f, region: e.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  placeholder="Soil pH"
                  value={structuredForm.soil_ph}
                  onChange={(e) => setStructuredForm((f) => ({ ...f, soil_ph: e.target.value }))}
                />
                <div className="flex gap-1">
                  <input
                    className="w-1/2 rounded-lg border border-slate-300 px-2 py-1"
                    placeholder="Lat"
                    value={structuredForm.lat}
                    onChange={(e) => setStructuredForm((f) => ({ ...f, lat: e.target.value }))}
                  />
                  <input
                    className="w-1/2 rounded-lg border border-slate-300 px-2 py-1"
                    placeholder="Lon"
                    value={structuredForm.lon}
                    onChange={(e) => setStructuredForm((f) => ({ ...f, lon: e.target.value }))}
                  />
                </div>
                <button
                  onClick={sendStructured}
                  className="col-span-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 sm:col-span-3"
                >
                  Send structured data
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowStructured((v) => !v)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                title="Toggle structured JSON input"
              >
                📊 JSON
              </button>
              <textarea
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="Describe your land, e.g. 'Biodiversity is declining on my land, semi-arid region'"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendFreeText();
                  }
                }}
              />
              <button
                onClick={sendFreeText}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Site Profile (memory)</h2>
              <button onClick={handleResetProfile} className="text-xs text-red-500 hover:underline">
                Reset
              </button>
            </div>
            {missingFields.length > 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                Missing critical fields: {missingFields.length}
              </p>
            )}
            <dl className="mt-3 space-y-1.5 text-xs">
              {PROFILE_FIELD_LABELS.map(([key, label]) => {
                const value = profile?.[key];
                const filled = value !== null && value !== undefined && value !== "";
                return (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className={filled ? "font-medium text-slate-800" : "text-slate-300"}>
                      {filled ? String(value) : "—"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">How it works</h2>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Extracts entities from your text/JSON into a persistent site profile.</li>
              <li>Asks a clarifying question if ≥2 critical fields are missing.</li>
              <li>Retrieves diverse knowledge chunks (soil/biodiversity/climate/land-use).</li>
              <li>Traverses a causal relationship graph (≥2 hops) for root-cause reasoning.</li>
              <li>Returns structured, cited, multi-metric recommendations.</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}

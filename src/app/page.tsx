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
  timestamp?: string;
}

const PRESET_SCENARIOS = [
  {
    title: "🌾 Semi-Arid Monoculture Wheat (Canonical)",
    desc: "SOC 0.3%, Low rainfall, Semi-arid monoculture wheat",
    payload: {
      soil_organic_carbon_pct: 0.3,
      rainfall: "low",
      crop: "monoculture wheat",
      region: "semi-arid",
      message: "I farm monoculture wheat in a semi-arid region with low rainfall and 0.3% soil organic carbon. How do I restore biodiversity and soil health?",
    },
  },
  {
    title: "🌳 Tropical Agroforestry Transition",
    desc: "High rainfall, degraded cropland, humid tropics",
    payload: {
      soil_organic_carbon_pct: 1.2,
      rainfall: "high",
      crop: "degraded cropland",
      region: "tropical",
      message: "My tropical farm has high rainfall but severe erosion and declining pollinator populations on degraded cropland.",
    },
  },
  {
    title: "🏜️ Arid Soil Regeneration",
    desc: "Arid zone, low SOC, severe moisture deficit",
    payload: {
      soil_organic_carbon_pct: 0.2,
      rainfall: "low",
      crop: "barley monoculture",
      region: "arid",
      message: "Arid parcel with 0.2% SOC, low rainfall, barley monoculture experiencing extreme drought vulnerability.",
    },
  },
  {
    title: "⚠️ Incomplete Input (Clarifying Gate)",
    desc: "Triggers parameter completeness checks",
    payload: {
      message: "Biodiversity is declining rapidly on my land. What should I do?",
    },
  },
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
  const [showStructuredModal, setShowStructuredModal] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<Record<string, boolean>>({});

  const [formValues, setFormValues] = useState({
    soil_organic_carbon_pct: "",
    soil_ph: "",
    rainfall: "low",
    avg_rainfall_mm: "",
    land_use: "",
    region: "semi-arid",
    lat: "",
    lon: "",
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      refreshProfile(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function refreshProfile(sid: string) {
    try {
      const res = await fetch(`/api/profile/${sid}`);
      if (res.ok) {
        const json = await res.json();
        setProfile(json.profile);
        setMissingFields(json.missingCriticalFields ?? []);
      }
    } catch {
      // Fallback gracefully
    }
  }

  function addMessage(msg: DisplayMessage) {
    setMessages((prev) => [...prev, { ...msg, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  }

  async function handleResult(result: ChatTurnResult) {
    addMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      text: result.message,
      retrievedKnowledge: result.retrievedKnowledge,
      reasoningLog: result.reasoningLog,
    });
    setProfile(result.profile);
    setMissingFields(result.missingFields ?? []);
  }

  async function sendFreeText(customText?: string) {
    const textToSend = customText || input.trim();
    if (!textToSend || !sessionId || loading) return;
    if (!customText) setInput("");

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      text: textToSend,
    });

    setLoading(true);
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: textToSend }),
      });
      const json = (await res.json()) as ChatTurnResult;
      await handleResult(json);
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        text: "⚠️ An error occurred communicating with the Environmental Intelligence Engine. Please check connectivity.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function submitStructured() {
    if (!sessionId || loading) return;
    const payload: Record<string, unknown> = {};
    if (formValues.soil_organic_carbon_pct) payload.soil_organic_carbon_pct = Number(formValues.soil_organic_carbon_pct);
    if (formValues.soil_ph) payload.soil_ph = Number(formValues.soil_ph);
    if (formValues.rainfall) payload.rainfall = formValues.rainfall;
    if (formValues.avg_rainfall_mm) payload.avg_rainfall_mm = Number(formValues.avg_rainfall_mm);
    if (formValues.land_use) payload.crop = formValues.land_use;
    if (formValues.region) payload.region = formValues.region;
    if (formValues.lat && formValues.lon) {
      payload.coordinates = { lat: Number(formValues.lat), lon: Number(formValues.lon) };
    }

    if (Object.keys(payload).length === 0) return;

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      text: `📊 **Structured Environmental Site Profile Submitted:**\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
    });

    setLoading(true);
    setShowStructuredModal(false);
    try {
      const res = await fetch("/api/chat/structured-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      const json = (await res.json()) as ChatTurnResult;
      await handleResult(json);
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        text: "⚠️ Error processing structured environmental payload.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSession() {
    if (!sessionId) return;
    await fetch(`/api/profile/${sessionId}/reset`, { method: "POST" });
    setMessages([]);
    await refreshProfile(sessionId);
  }

  function loadPreset(scenario: (typeof PRESET_SCENARIOS)[0]) {
    if (scenario.payload.soil_organic_carbon_pct !== undefined) {
      setFormValues({
        soil_organic_carbon_pct: String(scenario.payload.soil_organic_carbon_pct),
        soil_ph: "6.8",
        rainfall: scenario.payload.rainfall || "low",
        avg_rainfall_mm: scenario.payload.rainfall === "low" ? "200" : "900",
        land_use: scenario.payload.crop || "monoculture wheat",
        region: scenario.payload.region || "semi-arid",
        lat: "32.5",
        lon: "-102.1",
      });
    }
    sendFreeText(scenario.payload.message);
  }

  const isProfileComplete = profile && profile.soilOrganicCarbonPct !== null && profile.regionClimateZone !== null && profile.landUseType !== null && profile.avgRainfallMm !== null;

  return (
    <div className="min-h-screen flex flex-col bg-[#070e0c] text-slate-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-emerald-500/15 bg-[#091412]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-xl">🌿</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">Darukaa.Earth</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                AI Environmental Scientist
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Multi-Metric RAG &middot; 2-Hop Causal Reasoning &middot; Peer-Reviewed Scientific Evidence</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-300">
            <span className="text-emerald-400">📚</span>
            <span>69 Scientific Docs Active</span>
          </div>

          <button
            onClick={() => setShowStructuredModal(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 text-emerald-200 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>📊</span>
            <span className="hidden sm:inline">Structured Input</span>
          </button>

          <button
            onClick={handleResetSession}
            title="Reset site profile memory"
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-red-950/50 border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-300 text-xs transition-all cursor-pointer"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-4 p-3 sm:p-5">
        {/* Left Sidebar: Site Profile Telemetry */}
        <aside className="flex flex-col gap-3.5 order-2 lg:order-1">
          {/* Site Profile Telemetry Card */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-emerald-500/20 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/15">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-semibold text-sm">📡 Site Profile Memory</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isProfileComplete
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                }`}
              >
                {isProfileComplete ? "✓ Complete (100%)" : `${4 - (missingFields?.length || 4)}/4 Baseline Fields`}
              </span>
            </div>

            {/* Metrics List */}
            <div className="mt-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0c1a17] border border-emerald-900/30">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="text-amber-400">🌱</span> Soil Organic Carbon (SOC)
                </span>
                <span className="font-mono font-bold text-slate-100">
                  {profile?.soilOrganicCarbonPct !== null && profile?.soilOrganicCarbonPct !== undefined
                    ? `${profile.soilOrganicCarbonPct}%`
                    : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0c1a17] border border-emerald-900/30">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="text-cyan-400">🌧️</span> Rainfall Pattern / Precip
                </span>
                <span className="font-mono font-bold text-slate-100">
                  {profile?.rainfallDescriptor
                    ? `${profile.rainfallDescriptor} (${profile.avgRainfallMm ?? 200}mm)`
                    : profile?.avgRainfallMm
                    ? `${profile.avgRainfallMm} mm`
                    : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0c1a17] border border-emerald-900/30">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="text-lime-400">🌾</span> Current Land Use / Crop
                </span>
                <span className="font-mono font-semibold text-slate-200 capitalize">
                  {profile?.landUseType ? profile.landUseType.replace(/_/g, " ") : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0c1a17] border border-emerald-900/30">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="text-orange-400">☀️</span> Agro-Climatic Zone
                </span>
                <span className="font-mono font-semibold text-slate-200 capitalize">
                  {profile?.regionClimateZone || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0c1a17] border border-emerald-900/30">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="text-purple-400">🧪</span> Soil pH
                </span>
                <span className="font-mono text-slate-200">{profile?.soilPh ?? "—"}</span>
              </div>
            </div>

            {/* Missing Fields Warning if any */}
            {missingFields && missingFields.length > 0 && (
              <div className="mt-3.5 p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-300">
                <p className="font-bold flex items-center gap-1 mb-1">
                  <span>⚠️</span> Missing Baseline Parameters:
                </p>
                <p className="text-amber-200/80">{missingFields.join(", ")}</p>
              </div>
            )}
          </div>

          {/* Quick Scenario Launchers */}
          <div className="glass-panel rounded-2xl p-4 border border-emerald-500/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
              <span>⚡</span> Benchmark Test Scenarios
            </h3>
            <div className="space-y-2">
              {PRESET_SCENARIOS.map((sc, idx) => (
                <button
                  key={idx}
                  onClick={() => loadPreset(sc)}
                  className="w-full text-left p-2.5 rounded-xl bg-[#0a1714] hover:bg-emerald-900/40 border border-emerald-500/15 hover:border-emerald-500/40 transition-all cursor-pointer group"
                >
                  <p className="text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">{sc.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{sc.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Main Chat Panel */}
        <main className="flex flex-col h-[78vh] glass-panel rounded-2xl border border-emerald-500/20 overflow-hidden shadow-2xl order-1 lg:order-2">
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl mb-4 glow-emerald">
                  🌿
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
                  Welcome to <span className="gradient-text-emerald">Darukaa AI Environmental Scientist</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-lg mb-6 leading-relaxed">
                  Engineered with a 69-document peer-reviewed RAG knowledge base, 2-hop causal relationship graph, and
                  parameter completeness gate to generate scientifically validated ecological restoration plans.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg text-left">
                  {PRESET_SCENARIOS.slice(0, 2).map((sc, i) => (
                    <button
                      key={i}
                      onClick={() => loadPreset(sc)}
                      className="p-3 rounded-xl bg-[#0c1e1a]/80 hover:bg-emerald-950/60 border border-emerald-500/20 hover:border-emerald-500/50 transition-all text-xs cursor-pointer"
                    >
                      <span className="font-semibold text-emerald-300">{sc.title}</span>
                      <p className="text-slate-400 text-[11px] mt-1">{sc.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-lg shadow-emerald-950/50 rounded-br-xs"
                      : "glass-card border border-emerald-500/20 text-slate-100 rounded-bl-xs shadow-xl"
                  }`}
                >
                  {/* Role Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[11px] opacity-80">
                    <span className="font-bold flex items-center gap-1.5">
                      {m.role === "user" ? (
                        <>👤 Land Steward</>
                      ) : (
                        <>
                          <span className="text-emerald-400">🌿</span> Darukaa Environmental Scientist
                        </>
                      )}
                    </span>
                    {m.timestamp && <span>{m.timestamp}</span>}
                  </div>

                  {/* Body Content */}
                  <MarkdownLite text={m.text} />

                  {/* Expandable Scientific Trace & Citations */}
                  {m.role === "assistant" && (m.retrievedKnowledge?.length || m.reasoningLog?.length) ? (
                    <div className="mt-4 pt-3 border-t border-emerald-900/40">
                      <button
                        onClick={() => setExpandedTrace((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                        className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>🔬</span>
                        <span>{expandedTrace[m.id] ? "Hide" : "Inspect"} Scientific Trace &amp; Citations ({m.retrievedKnowledge?.length || 0})</span>
                      </button>

                      {expandedTrace[m.id] && (
                        <div className="mt-3 p-3 rounded-xl bg-[#06120f] border border-emerald-500/20 space-y-3 text-xs">
                          {m.retrievedKnowledge && m.retrievedKnowledge.length > 0 && (
                            <div>
                              <p className="font-bold text-slate-300 mb-1.5">Retrieved Scientific Evidence Chunks:</p>
                              <div className="space-y-1.5">
                                {m.retrievedKnowledge.map((cit, ci) => (
                                  <div key={ci} className="p-2 rounded bg-emerald-950/30 border border-emerald-500/10 flex items-start justify-between gap-2">
                                    <div>
                                      <span className="font-semibold text-emerald-300">{cit.source}</span>
                                      <span className="text-slate-400 text-[11px] ml-1.5">&middot; {cit.topic}</span>
                                      <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">{cit.content}</p>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">
                                      {Math.round(cit.similarity * 100)}% Match
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {m.reasoningLog && m.reasoningLog.length > 0 && (
                            <div>
                              <p className="font-bold text-slate-300 mb-1">Causal Graph &amp; Chain-of-Thought:</p>
                              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                                {m.reasoningLog.map((logItem, li) => (
                                  <li key={li}>
                                    <strong className="text-slate-300">{logItem.step}:</strong> {logItem.content}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="glass-card rounded-2xl rounded-bl-xs p-4 border border-emerald-500/30 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-emerald-300 font-medium animate-pulse">
                    Traversing 2-hop causal graph &amp; evaluating scientific citations...
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <div className="p-3 sm:p-4 bg-[#081412] border-t border-emerald-500/15">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendFreeText();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your environmental question or describe your parcel (e.g., SOC 0.3%, low rain, semi-arid)..."
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-[#0c1e1a] border border-emerald-500/25 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 font-semibold text-sm text-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-900/40"
              >
                <span>Send</span>
                <span>➔</span>
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* Structured Parameter Modal Drawer */}
      {showStructuredModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full rounded-2xl p-6 border border-emerald-500/30 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>📊</span> Structured Environmental Parameter Input
              </h3>
              <button
                onClick={() => setShowStructuredModal(false)}
                className="text-slate-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Soil Organic Carbon (SOC %)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0.3"
                  value={formValues.soil_organic_carbon_pct}
                  onChange={(e) => setFormValues({ ...formValues, soil_organic_carbon_pct: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#0a1815] border border-emerald-500/20 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Soil pH (0 - 14)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 6.8"
                  value={formValues.soil_ph}
                  onChange={(e) => setFormValues({ ...formValues, soil_ph: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#0a1815] border border-emerald-500/20 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Rainfall Condition</label>
                <select
                  value={formValues.rainfall}
                  onChange={(e) => setFormValues({ ...formValues, rainfall: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#0a1815] border border-emerald-500/20 text-slate-100"
                >
                  <option value="low">Low (&lt; 400 mm/yr)</option>
                  <option value="moderate">Moderate (400 - 800 mm)</option>
                  <option value="high">High (&gt; 800 mm/yr)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Climate Zone</label>
                <select
                  value={formValues.region}
                  onChange={(e) => setFormValues({ ...formValues, region: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#0a1815] border border-emerald-500/20 text-slate-100"
                >
                  <option value="semi-arid">Semi-Arid</option>
                  <option value="arid">Arid</option>
                  <option value="tropical">Tropical</option>
                  <option value="temperate">Temperate</option>
                  <option value="mediterranean">Mediterranean</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-slate-300 font-medium mb-1">Current Land Use / Crop</label>
                <input
                  type="text"
                  placeholder="e.g. monoculture wheat, agroforestry, degraded pasture"
                  value={formValues.land_use}
                  onChange={(e) => setFormValues({ ...formValues, land_use: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#0a1815] border border-emerald-500/20 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Latitude (Optional)</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 32.5"
                  value={formValues.lat}
                  onChange={(e) => setFormValues({ ...formValues, lat: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#0a1815] border border-emerald-500/20 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Longitude (Optional)</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="e.g. -102.1"
                  value={formValues.lon}
                  onChange={(e) => setFormValues({ ...formValues, lon: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#0a1815] border border-emerald-500/20 text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-emerald-500/20">
              <button
                type="button"
                onClick={() => setShowStructuredModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitStructured}
                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-black shadow-lg shadow-emerald-900/40"
              >
                Evaluate &amp; Reason
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

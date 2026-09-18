"""
main.py — Standalone Reference FastAPI backend application.

Implements all 6 challenge endpoints:
  POST /chat/message
  GET  /chat/history/{session_id}
  POST /chat/structured-input
  GET  /knowledge/search?q=
  GET  /profile/{session_id}
  POST /profile/{session_id}/reset
  GET  /health
"""
import os
import sys
import uuid
from typing import Any, Dict, Optional, List
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.rag.vector_store import vector_store
from reasoning_engine import (
    reasoning_engine,
    build_reasoning_and_output,
    check_missing_critical_fields,
    extract_from_structured,
    extract_from_text,
)

load_dotenv()

app = FastAPI(
    title="Darukaa Biodiversity Intelligence System",
    description="Scientific Environmental Intelligence API powered by multi-metric RAG and 2-hop causal reasoning.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session stores for standalone execution
sessions_db: Dict[str, Dict[str, Any]] = {}
messages_db: Dict[str, List[Dict[str, Any]]] = {}

class ChatMessageRequest(BaseModel):
    session_id: Optional[str] = None
    message: Optional[str] = None
    structured: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"

def get_profile(session_id: str) -> Dict[str, Any]:
    if session_id not in sessions_db:
        sessions_db[session_id] = {
            "session_id": session_id,
            "soil_ph": None,
            "soil_organic_carbon_pct": None,
            "soil_moisture_pct": None,
            "land_use_type": None,
            "region_climate_zone": None,
            "avg_rainfall_mm": None,
            "rainfall_descriptor": None,
            "avg_temp_c": None,
            "species_richness_count": None,
            "habitat_diversity_index": None,
            "pollution_level": None,
            "deforestation_rate_pct": None,
            "latitude": None,
            "longitude": None
        }
    return sessions_db[session_id]

def update_profile(session_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    profile = get_profile(session_id)
    for k, v in patch.items():
        if v is not None:
            profile[k] = v
    return profile

def retrieve_knowledge(query: str, climate: Optional[str] = None, land_use: Optional[str] = None, k: int = 6):
    citations = vector_store.search(
        query=f"{query} {climate or ''} {land_use or ''}",
        top_k=k
    )
    results = []
    for cit in citations:
        results.append({
            "id": cit.doc_id,
            "content": cit.retrieved_chunk,
            "category": cit.topic or "ecology",
            "topic": cit.topic,
            "source": f"{cit.organization} ({cit.year})",
            "source_url": cit.url,
            "confidence": "high",
            "similarity": round(float(cit.relevance_score or 0.88), 4)
        })
    return results

@app.post("/chat/message")
def chat_message(body: ChatMessageRequest):
    session_id = body.session_id or str(uuid.uuid4())
    extras = body.dict(exclude={"session_id", "message", "structured"}, exclude_none=True)
    structured_payload = body.structured or (extras if extras else None)

    extracted = {}
    if body.message:
        extracted.update(extract_from_text(body.message))
    if structured_payload:
        extracted.update(extract_from_structured(structured_payload))

    profile = update_profile(session_id, extracted)
    
    # Save user message
    if session_id not in messages_db:
        messages_db[session_id] = []
    if body.message:
        messages_db[session_id].append({"role": "user", "content": body.message, "extracted": extracted})

    missing = check_missing_critical_fields(profile)
    if len(missing) >= 2:
        clarifying_msg = f"To give you accurate, scientifically grounded recommendations, I need: soil organic carbon %, your region's rainfall pattern, and current land use/crop type. Can you share these baseline parameters?"
        messages_db[session_id].append({"role": "assistant", "content": clarifying_msg})
        return {
            "session_id": session_id,
            "type": "clarifying_question",
            "missing_fields": missing,
            "message": clarifying_msg,
            "profile": profile,
        }

    res = reasoning_engine.execute_reasoning_pipeline(body.message or "", profile)
    messages_db[session_id].append({"role": "assistant", "content": res.get("message", "")})

    return {
        "session_id": session_id,
        "type": "recommendation",
        "message": res.get("message"),
        "causal_chain": res.get("recommendations", [{}])[0].get("connects_variables", []),
        "retrieved_knowledge": res.get("retrieved_knowledge", []),
        "structured_output": {
            "recommendations": res.get("recommendations", []),
            "cross_variable_analysis": res.get("cross_variable_analysis"),
            "follow_up_question": res.get("follow_up_question")
        },
        "profile": profile,
    }

@app.post("/chat/structured-input")
def chat_structured_input(body: ChatMessageRequest):
    return chat_message(body)

@app.get("/chat/history/{session_id}")
def chat_history(session_id: str):
    return {"session_id": session_id, "messages": messages_db.get(session_id, [])}

@app.get("/knowledge/search")
def knowledge_search(q: str, k: int = 6):
    if not q:
        raise HTTPException(status_code=400, detail="Missing query param 'q'")
    return {"query": q, "results": retrieve_knowledge(q, None, None, k)}

@app.get("/profile/{session_id}")
def profile_get(session_id: str):
    profile = get_profile(session_id)
    return {"profile": profile, "missing_critical_fields": check_missing_critical_fields(profile)}

@app.post("/profile/{session_id}/reset")
def profile_reset(session_id: str):
    if session_id in sessions_db:
        del sessions_db[session_id]
    if session_id in messages_db:
        del messages_db[session_id]
    return {"ok": True, "profile": get_profile(session_id)}

@app.get("/health")
def health():
    return {
        "ok": True,
        "status": "healthy",
        "service": "Darukaa FastAPI Reference Backend",
        "vector_store": "active",
        "knowledge_chunks": len(vector_store.in_memory_docs)
    }

if __name__ == "__main__":
    import uvicorn
    print("\n[STARTING] Darukaa FastAPI Backend on http://127.0.0.1:8000 ...")
    uvicorn.run(app, host="127.0.0.1", port=8000)

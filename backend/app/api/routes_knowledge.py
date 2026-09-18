from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.db_models import Recommendation, Document
from app.models.schemas import KnowledgeIngestRequest
from app.rag.vector_store import vector_store

router = APIRouter()

@router.post("/knowledge/ingest")
async def ingest_knowledge(payload: KnowledgeIngestRequest, db: Session = Depends(get_db)):
    doc_dict = payload.dict()
    doc_id = f"custom_doc_{len(vector_store.in_memory_docs) + 1}"
    doc_dict["id"] = doc_id
    
    vector_store.ingest_documents([doc_dict])
    
    doc_record = Document(
        id=doc_id,
        title=payload.title,
        organization=payload.organization,
        year=payload.year,
        topic=payload.topic,
        source_url=payload.url,
        doi=payload.doi,
        tier=payload.tier,
        content=payload.content,
        variables=payload.variables
    )
    db.add(doc_record)
    db.commit()
    
    return {
        "status": "success",
        "document_id": doc_id,
        "message": f"Successfully vectorized and indexed '{payload.title}' by {payload.organization}"
    }

@router.get("/sources")
async def get_scientific_sources():
    sources = []
    for item in vector_store.in_memory_docs:
        meta = item["metadata"]
        sources.append({
            "id": item["id"],
            "organization": meta.get("organization"),
            "title": meta.get("title"),
            "year": meta.get("year"),
            "topic": meta.get("topic"),
            "tier": meta.get("tier"),
            "url": meta.get("url"),
            "doi": meta.get("doi"),
            "excerpt": item["content"][:200] + "..."
        })
    return {"total_sources": len(sources), "sources": sources}

@router.get("/recommendations/{conversation_id}")
async def get_conversation_recommendations(conversation_id: str, db: Session = Depends(get_db)):
    recs = db.query(Recommendation).filter(Recommendation.conversation_id == conversation_id).all()
    return {
        "conversation_id": conversation_id,
        "recommendations": [
            {
                "id": r.id,
                "action": r.action,
                "reasoning": r.reasoning,
                "metrics": r.metrics,
                "time_horizon": r.time_horizon,
                "confidence": r.confidence,
                "evidence_source": r.evidence_source,
                "trade_offs": r.trade_offs,
                "created_at": r.created_at
            }
            for r in recs
        ]
    }

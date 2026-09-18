from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.db_models import EnvironmentalProfile, Conversation
from app.services.conversation_service import conversation_service

router = APIRouter()

@router.post("/environment")
async def save_environment(payload: Dict[str, Any], db: Session = Depends(get_db)):
    conv_id = payload.get("conversation_id")
    conv = conversation_service.get_or_create_conversation(db, conv_id)
    profile = conversation_service.update_profile(db, conv, payload.get("environment", payload))
    return {
        "status": "success",
        "profile_id": profile.id,
        "conversation_id": conv.id,
        "profile_data": profile.profile_data
    }

@router.get("/environment/{id}")
async def get_environment(id: str, db: Session = Depends(get_db)):
    profile = db.query(EnvironmentalProfile).filter(EnvironmentalProfile.id == id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Environmental profile not found")
    return {
        "id": profile.id,
        "region": profile.region,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "climate_zone": profile.climate_zone,
        "profile_data": profile.profile_data,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at
    }

@router.get("/conversation/{id}")
async def get_conversation(id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter((Conversation.id == id) | (Conversation.session_id == id)).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    profile_data = {}
    if conv.profile_id:
        p = db.query(EnvironmentalProfile).filter(EnvironmentalProfile.id == conv.profile_id).first()
        if p:
            profile_data = p.profile_data
            
    messages = [
        {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at}
        for m in conv.messages
    ]
    
    return {
        "id": conv.id,
        "title": conv.title,
        "profile_id": conv.profile_id,
        "profile_data": profile_data,
        "messages": messages,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at
    }

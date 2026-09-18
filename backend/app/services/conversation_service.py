from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.db_models import Conversation, Message, EnvironmentalProfile, EnvironmentalMetric, Recommendation, RetrievalLog
from app.reasoning.variable_extractor import variable_extractor

class ConversationService:
    def get_or_create_conversation(self, db: Session, conversation_id: Optional[str] = None) -> Conversation:
        if conversation_id:
            conv = db.query(Conversation).filter((Conversation.id == conversation_id) | (Conversation.session_id == conversation_id)).first()
            if conv:
                return conv
                
        conv = Conversation(session_id=conversation_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return conv

    def get_profile(self, db: Session, profile_id: Optional[str]) -> Optional[EnvironmentalProfile]:
        if not profile_id:
            return None
        return db.query(EnvironmentalProfile).filter(EnvironmentalProfile.id == profile_id).first()

    def update_profile(self, db: Session, conversation: Conversation, updates: Dict[str, Any]) -> EnvironmentalProfile:
        profile = None
        if conversation.profile_id:
            profile = db.query(EnvironmentalProfile).filter(EnvironmentalProfile.id == conversation.profile_id).first()
            
        if not profile:
            profile = EnvironmentalProfile(profile_data={})
            db.add(profile)
            db.commit()
            db.refresh(profile)
            conversation.profile_id = profile.id
            db.commit()

        current_data = profile.profile_data or {}
        merged = variable_extractor.merge_profiles(current_data, updates)
        
        if "region" in updates:
            profile.region = updates["region"]
        if "latitude" in updates:
            profile.latitude = updates["latitude"]
        if "longitude" in updates:
            profile.longitude = updates["longitude"]
        if "climate_zone" in updates:
            profile.climate_zone = updates["climate_zone"]

        profile.profile_data = merged
        db.commit()
        db.refresh(profile)
        return profile

    def add_message(self, db: Session, conversation_id: str, role: str, content: str, structured_payload: Optional[Dict[str, Any]] = None) -> Message:
        msg = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            structured_payload=structured_payload
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg

    def save_recommendations(self, db: Session, conversation_id: str, recs: List[Any]):
        for r in recs:
            rec_db = Recommendation(
                conversation_id=conversation_id,
                action=r.action,
                reasoning=r.why_it_works,
                metrics=[m.dict() if hasattr(m, 'dict') else m for m in r.metrics_affected],
                time_horizon=r.time_horizon,
                confidence=r.confidence,
                evidence_source=f"{r.evidence.organization} ({r.evidence.year}): {r.evidence.title}",
                trade_offs=r.trade_offs
            )
            db.add(rec_db)
        db.commit()

    def save_retrieval_logs(self, db: Session, conversation_id: str, query: str, citations: List[Any]):
        for cit in citations:
            log = RetrievalLog(
                conversation_id=conversation_id,
                query=query,
                document_id=cit.source_id,
                similarity_score=cit.relevance_score or 0.85,
                source_organization=cit.organization
            )
            db.add(log)
        db.commit()

conversation_service = ConversationService()

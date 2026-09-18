from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.intelligence_orchestrator import orchestrator

router = APIRouter()

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(payload: AnalyzeRequest, db: Session = Depends(get_db)):
    try:
        response = await orchestrator.process_analysis(
            db=db,
            message=payload.message,
            environment=payload.environment,
            conversation_id=payload.conversation_id,
            latitude=payload.latitude,
            longitude=payload.longitude
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Environmental analysis error: {str(e)}")

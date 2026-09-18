from fastapi import APIRouter
from app.api.routes_chat import router as chat_router
from app.api.routes_analyze import router as analyze_router
from app.api.routes_environment import router as env_router
from app.api.routes_knowledge import router as knowledge_router
from app.api.routes_scenarios import router as scenarios_router

api_router = APIRouter()

api_router.include_router(chat_router, tags=["Conversational AI"])
api_router.include_router(analyze_router, tags=["Environmental Analysis"])
api_router.include_router(env_router, tags=["Environmental Memory"])
api_router.include_router(knowledge_router, tags=["Knowledge & RAG"])
api_router.include_router(scenarios_router, tags=["Test Scenarios"])

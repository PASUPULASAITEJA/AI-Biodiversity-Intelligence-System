from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api.api_router import api_router
from app.rag.vector_store import vector_store

try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"[Database] Warning initializing tables: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        print("[Database] All SQLAlchemy tables initialized successfully.")
    except Exception as e:
        print(f"[Database] Warning initializing tables: {e}")
        
    print(f"[VectorStore] Initialized with {len(vector_store.in_memory_docs)} authoritative scientific documents.")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-powered Biodiversity Intelligence System backed by multi-metric causal reasoning and scientific RAG.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router) # Also mount at root for /chat/message etc.

@app.get("/api/health")
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "knowledge_documents_indexed": len(vector_store.in_memory_docs),
        "tier_1_sources": ["FAO", "IPCC", "UNEP", "IPBES", "CIFOR-ICRAF"],
        "vector_store_backend": "ChromaDB + Dense Hybrid",
        "reasoning_engine": "Multi-Metric Causal Graph + Deterministic Risk Scorer"
    }

@app.get("/")
async def root():
    return {
        "message": "Welcome to Darukaa.Earth AI Biodiversity Intelligence API",
        "docs_url": "/docs",
        "health_check": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

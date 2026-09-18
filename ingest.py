import os
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app.rag.vector_store import vector_store

def run_ingestion():
    print("=================================================================")
    print("   Darukaa.Earth: RAG Scientific Knowledge Ingestion Pipeline    ")
    print("=================================================================")

    # Attempt PostgreSQL persistence if available
    db = None
    try:
        from app.core.database import SessionLocal, Base, engine
        from app.models.db_models import Document
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        print("[Ingest] Connected to relational database for document metadata.")
    except Exception as e:
        print("[Ingest] Relational DB not active, indexing directly into high-speed vector store.")

    kb_dir = Path(__file__).resolve().parent / "knowledge_base"
    json_files = list(kb_dir.glob("*.json"))
    if (kb_dir / "processed").exists():
        json_files += list((kb_dir / "processed").glob("*.json"))
    
    total_loaded = 0
    all_chunks = []

    for file_path in json_files:
        print(f"\n[Ingest] Reading scientific facts from: {file_path.name}")
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                entries = json.load(f)
                if isinstance(entries, dict):
                    entries = [entries]
                for doc in entries:
                    total_loaded += 1
                    doc_id = doc.get("id", f"fact_{total_loaded}")
                    org = doc.get("organization") or doc.get("source", "FAO/IPCC Scientific Corpus").split()[0]
                    title = doc.get("title") or doc.get("topic", "").replace("_", " ").title()
                    year = doc.get("year", 2023)
                    content = doc.get("content", "")
                    category = doc.get("category", "biodiversity")
                    
                    app_cond = doc.get("applicable_conditions", {})
                    climates = app_cond.get("climate", ["all"])
                    land_uses = app_cond.get("land_use", ["all"])
                    
                    metadata = {
                        "source_id": doc_id,
                        "organization": org,
                        "title": title,
                        "year": int(year) if str(year).isdigit() else 2023,
                        "topic": doc.get("topic", category),
                        "category": category,
                        "variables": json.dumps(doc.get("metrics_affected", [])),
                        "quantitative_impact": doc.get("quantitative_impact", ""),
                        "climate_zone": ",".join(climates) if isinstance(climates, list) else str(climates),
                        "land_use": ",".join(land_uses) if isinstance(land_uses, list) else str(land_uses),
                        "tier": int(doc.get("tier", 1)),
                        "url": doc.get("source_url") or doc.get("url", ""),
                        "doi": doc.get("doi", "")
                    }
                    
                    all_chunks.append({
                        "id": doc_id,
                        "content": content,
                        "metadata": metadata
                    })
                    
                    if db:
                        try:
                            from app.models.db_models import Document
                            existing = db.query(Document).filter(Document.id == doc_id).first()
                            if not existing:
                                db_doc = Document(
                                    id=doc_id,
                                    title=title,
                                    organization=org,
                                    year=int(year) if str(year).isdigit() else 2023,
                                    topic=doc.get("topic", category),
                                    source_url=metadata["url"],
                                    doi=metadata["doi"],
                                    tier=metadata["tier"],
                                    content=content,
                                    variables=doc.get("metrics_affected", [])
                                )
                                db.add(db_doc)
                        except Exception:
                            pass
        except Exception as e:
            print(f"  [Warning] Error loading {file_path.name}: {e}")

    if db:
        try:
            db.commit()
            db.close()
        except Exception:
            pass

    print(f"\n[Ingest] Embedding and vectorizing {len(all_chunks)} scientific entries into Vector Store...")
    vector_store.ingest_documents(all_chunks)
    print(f"\n[SUCCESS] Indexed {len(all_chunks)} scientific knowledge chunks with metadata filtering enabled!")

if __name__ == "__main__":
    run_ingestion()

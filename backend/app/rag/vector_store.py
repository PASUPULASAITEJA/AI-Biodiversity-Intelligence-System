import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
from app.core.config import settings
from app.rag.embeddings import embedding_service
from app.models.schemas import ScientificCitation

class VectorStore:
    def __init__(self):
        self.persist_dir = settings.CHROMA_PERSIST_DIR
        self.client = None
        self.collection = None
        self.in_memory_docs: List[Dict[str, Any]] = []
        self._init_store()
        
    def _init_store(self):
        try:
            import chromadb
            os.makedirs(self.persist_dir, exist_ok=True)
            self.client = chromadb.PersistentClient(path=self.persist_dir)
            self.collection = self.client.get_or_create_collection(
                name="biodiversity_scientific_corpus",
                metadata={"description": "Authoritative Environmental & Biodiversity Research Papers"}
            )
        except Exception:
            self.client = None
            self.collection = None
            
        self._load_seed_documents()

    def _load_seed_documents(self):
        kb_path = Path(settings.KNOWLEDGE_BASE_DIR) / "scientific_facts_50.json"
        if not kb_path.exists():
            kb_path = Path(settings.KNOWLEDGE_BASE_DIR) / "processed" / "scientific_documents.json"
        if kb_path.exists():
            try:
                with open(kb_path, "r", encoding="utf-8") as f:
                    docs = json.load(f)
                    self.ingest_documents(docs)
            except Exception as e:
                print(f"[VectorStore] Error loading seed documents: {e}")

    def ingest_documents(self, documents: List[Dict[str, Any]]):
        ids = []
        texts = []
        metadatas = []
        embeddings = []
        
        for doc in documents:
            doc_id = doc.get("id", str(len(self.in_memory_docs)))
            content = doc.get("content", "")
            meta = {
                "source_id": doc.get("source_id", doc_id),
                "organization": doc.get("organization") or doc.get("source", "FAO/IPCC").split()[0],
                "title": doc.get("title") or doc.get("topic", "").replace("_", " ").title(),
                "year": int(doc.get("year", 2023)),
                "topic": doc.get("topic", "biodiversity"),
                "variables": json.dumps(doc.get("metrics_affected", doc.get("variables", []))),
                "region": doc.get("region", "global"),
                "climate_zone": doc.get("climate_zone", "all"),
                "tier": int(doc.get("tier", 1)),
                "url": doc.get("source_url") or doc.get("url", ""),
                "doi": doc.get("doi", "")
            }
            emb = embedding_service.embed_text(content)
            
            ids.append(doc_id)
            texts.append(content)
            metadatas.append(meta)
            embeddings.append(emb)
            
            self.in_memory_docs.append({
                "id": doc_id,
                "content": content,
                "metadata": meta,
                "embedding": np.array(emb, dtype=np.float32)
            })
            
        if self.collection is not None and ids:
            try:
                self.collection.upsert(
                    ids=ids,
                    documents=texts,
                    metadatas=metadatas,
                    embeddings=embeddings
                )
            except Exception:
                pass

    def search(
        self,
        query: str,
        target_variables: Optional[List[str]] = None,
        top_k: int = 4,
        min_relevance: float = 0.25
    ) -> List[ScientificCitation]:
        query_emb = np.array(embedding_service.embed_text(query), dtype=np.float32)
        results: List[ScientificCitation] = []
        candidates = []
        query_lower = query.lower()
        
        for item in self.in_memory_docs:
            content = item["content"]
            meta = item["metadata"]
            emb = item["embedding"]
            
            norm_q = np.linalg.norm(query_emb)
            norm_e = np.linalg.norm(emb)
            sim = float(np.dot(query_emb, emb) / (norm_q * norm_e)) if norm_q > 0 and norm_e > 0 else 0.0
            
            var_list = json.loads(meta.get("variables", "[]"))
            boost = 0.0
            if target_variables:
                for tv in target_variables:
                    if tv.lower() in [v.lower() for v in var_list] or tv.lower() in content.lower():
                        boost += 0.12
            
            if meta.get("organization", "").lower() in query_lower:
                boost += 0.08
            if meta.get("topic", "").lower() in query_lower:
                boost += 0.10
                
            tier = meta.get("tier", 1)
            tier_bonus = 0.05 if tier == 1 else (0.02 if tier == 2 else 0.0)
            
            final_score = min(0.99, sim + boost + tier_bonus)
            
            matched_vars = [v for v in var_list if v.lower() in query_lower or (target_variables and v.lower() in [t.lower() for t in target_variables])]
            why_selected = f"Selected from Tier {tier} source ({meta.get('organization')}) due to high relevance ({final_score:.2f}) on environmental variables: {', '.join(matched_vars) if matched_vars else meta.get('topic')}."

            candidates.append({
                "score": final_score,
                "item": item,
                "why_selected": why_selected
            })
            
        candidates.sort(key=lambda x: x["score"], reverse=True)
        
        for cand in candidates[:top_k]:
            if cand["score"] >= min_relevance or len(results) == 0:
                meta = cand["item"]["metadata"]
                results.append(ScientificCitation(
                    source_id=meta.get("source_id", cand["item"]["id"]),
                    organization=meta.get("organization", "FAO/IPCC"),
                    title=meta.get("title", ""),
                    year=meta.get("year", 2023),
                    topic=meta.get("topic", ""),
                    relevance_score=round(cand["score"], 3),
                    url=meta.get("url"),
                    doi=meta.get("doi"),
                    tier=meta.get("tier", 1),
                    retrieved_chunk=cand["item"]["content"],
                    why_selected=cand["why_selected"]
                ))
                
        return results

vector_store = VectorStore()

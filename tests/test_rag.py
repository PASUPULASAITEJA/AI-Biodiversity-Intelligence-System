"""
tests/test_rag.py
Tests RAG vector store and knowledge base retrieval mechanisms.
"""
import os
import sys
import json
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.rag.vector_store import vector_store

def test_knowledge_base_files_exist():
    kb_dir = os.path.join(os.path.dirname(__file__), "..", "knowledge_base")
    assert os.path.exists(kb_dir)
    files = [f for f in os.listdir(kb_dir) if f.endswith(".json")]
    assert len(files) >= 5
    
    # Check 5 core categories are represented
    categories_found = set()
    total_docs = 0
    for f in files:
        with open(os.path.join(kb_dir, f), "r", encoding="utf-8") as fp:
            data = json.load(fp)
            assert isinstance(data, list)
            total_docs += len(data)
            for item in data:
                if "category" in item:
                    categories_found.add(item["category"])

    assert total_docs >= 50
    assert "soil" in categories_found
    assert "land_use" in categories_found
    assert "biodiversity" in categories_found
    assert "climate" in categories_found
    assert "human_impact" in categories_found

def test_vector_store_retrieves_relevant_chunks():
    results = vector_store.search("semi-arid monoculture wheat low soil organic carbon", top_k=5)
    assert len(results) >= 3
    for r in results:
        assert r.retrieved_chunk is not None
        assert len(r.retrieved_chunk) > 10
        assert r.relevance_score is not None
        assert r.relevance_score > 0

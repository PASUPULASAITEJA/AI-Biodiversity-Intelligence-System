import numpy as np
from typing import List
import hashlib

class EmbeddingService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.dim = 384
        self._model = None
        self._load_model()
        
    def _load_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)
        except Exception:
            self._model = None

    def embed_text(self, text: str) -> List[float]:
        if self._model is not None:
            try:
                emb = self._model.encode(text, normalize_embeddings=True)
                return emb.tolist()
            except Exception:
                pass
        return self._fallback_embed(text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if self._model is not None:
            try:
                embeddings = self._model.encode(texts, normalize_embeddings=True)
                return [emb.tolist() for emb in embeddings]
            except Exception:
                pass
        return [self._fallback_embed(t) for t in texts]

    def _fallback_embed(self, text: str) -> List[float]:
        words = text.lower().split()
        vector = np.zeros(self.dim, dtype=np.float32)
        
        domain_weights = {
            "carbon": 3.0, "soc": 3.5, "soil": 2.5, "biodiversity": 3.0,
            "monoculture": 2.8, "polyculture": 2.8, "rainfall": 2.5,
            "drought": 2.8, "agroforestry": 3.0, "pollinator": 3.0,
            "cover": 2.5, "crop": 2.0, "fao": 2.0, "ipcc": 2.0,
            "unep": 2.0, "ipbes": 2.0, "wetland": 2.5, "fragmentation": 2.8,
            "pesticide": 2.8, "microbiome": 2.5, "riparian": 2.8, "buffer": 2.5
        }
        
        for w in words:
            h = int(hashlib.md5(w.encode('utf-8')).hexdigest(), 16)
            idx = h % self.dim
            weight = domain_weights.get(w, 1.0)
            vector[idx] += weight
            idx2 = (h >> 4) % self.dim
            vector[idx2] += 0.5 * weight
            
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        return vector.tolist()

embedding_service = EmbeddingService()

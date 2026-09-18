from typing import List, Dict, Any

class DocumentChunk:
    def __init__(self, id: str, content: str, metadata: Dict[str, Any]):
        self.id = id
        self.content = content
        self.metadata = metadata

class ScientificTextSplitter:
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str, base_metadata: Dict[str, Any], doc_id_prefix: str) -> List[DocumentChunk]:
        sentences = [s.strip() for s in text.replace('\n', ' ').split('. ') if s.strip()]
        chunks: List[DocumentChunk] = []
        
        current_chunk = []
        current_length = 0
        chunk_idx = 0
        
        for sentence in sentences:
            sentence_with_dot = sentence if sentence.endswith('.') else sentence + '.'
            words = sentence_with_dot.split()
            sentence_len = len(words)
            
            if current_length + sentence_len > self.chunk_size and current_chunk:
                chunk_text = " ".join(current_chunk)
                chunk_id = f"{doc_id_prefix}_chunk_{chunk_idx}"
                meta = dict(base_metadata)
                meta["chunk_index"] = chunk_idx
                chunks.append(DocumentChunk(chunk_id, chunk_text, meta))
                chunk_idx += 1
                
                overlap_words = current_chunk[-max(1, int(self.chunk_overlap / 10)):] if len(current_chunk) > 1 else []
                current_chunk = overlap_words + [sentence_with_dot]
                current_length = sum(len(s.split()) for s in current_chunk)
            else:
                current_chunk.append(sentence_with_dot)
                current_length += sentence_len
                
        if current_chunk:
            chunk_text = " ".join(current_chunk)
            chunk_id = f"{doc_id_prefix}_chunk_{chunk_idx}"
            meta = dict(base_metadata)
            meta["chunk_index"] = chunk_idx
            chunks.append(DocumentChunk(chunk_id, chunk_text, meta))
            
        return chunks

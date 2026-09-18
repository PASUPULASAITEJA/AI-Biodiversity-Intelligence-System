import re
from typing import List, Dict, Any
from app.models.schemas import ScientificCitation

class CitationValidator:
    def __init__(self):
        self.known_orgs = {"FAO", "IPCC", "UNEP", "IPBES", "CIFOR-ICRAF", "Nature Ecology & Evolution", "American Society of Agronomy", "Society for Conservation Biology", "USDA"}

    def validate_citations(self, text: str, available_citations: List[ScientificCitation]) -> Dict[str, Any]:
        valid_citations = []
        unverified_claims = []
        citation_matches = re.findall(r'\[([A-Za-z0-9\s\-]+),\s*(\d{4})\]', text)
        
        for org, year in citation_matches:
            matched = False
            for cit in available_citations:
                if org.strip().lower() in cit.organization.lower() and int(year) == cit.year:
                    valid_citations.append(cit)
                    matched = True
                    break
            if not matched:
                unverified_claims.append(f"[{org}, {year}]")
                
        return {
            "is_valid": len(unverified_claims) == 0,
            "valid_citations": valid_citations,
            "unverified_citations": unverified_claims
        }

citation_validator = CitationValidator()

import re
from typing import Dict, Any

class VariableExtractor:
    def extract_from_text(self, text: str) -> Dict[str, Any]:
        extracted: Dict[str, Any] = {
            "soil": {},
            "land_use": {},
            "climate": {},
            "biodiversity": {},
            "human_impact": {}
        }
        
        lower = text.lower()
        
        # 1. Soil Organic Carbon (SOC)
        soc_match = re.search(r'(?:soc|soil\s*organic\s*carbon|organic\s*carbon)\s*(?:is|=|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*%', lower)
        if not soc_match:
            soc_match = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:soc|soil\s*organic\s*carbon)', lower)
        if not soc_match:
            soc_match = re.search(r'\bsoc\s*=\s*([0-9]+(?:\.[0-9]+)?)', lower)
        if soc_match:
            try:
                extracted["soil"]["organic_carbon"] = float(soc_match.group(1))
            except ValueError:
                pass

        # Soil pH
        ph_match = re.search(r'(?:soil\s*)?ph\s*(?:is|=|:)?\s*([0-9]+(?:\.[0-9]+)?)', lower)
        if ph_match:
            try:
                extracted["soil"]["ph"] = float(ph_match.group(1))
            except ValueError:
                pass

        # Soil Moisture
        if "moisture is low" in lower or "low moisture" in lower or "dry soil" in lower:
            extracted["soil"]["moisture"] = "low"
        elif "moisture is high" in lower or "high moisture" in lower or "waterlogged" in lower:
            extracted["soil"]["moisture"] = "high"
        elif "moderate moisture" in lower or "adequate moisture" in lower:
            extracted["soil"]["moisture"] = "moderate"

        # 2. Climate
        if "rainfall = low" in lower or "low rainfall" in lower or "rainfall is low" in lower or "rainfall: low" in lower or "arid" in lower:
            extracted["climate"]["rainfall"] = "low"
            extracted["climate"]["drought_risk"] = "high"
        elif "high rainfall" in lower or "rainfall is high" in lower or "heavy rain" in lower:
            extracted["climate"]["rainfall"] = "high"
            extracted["climate"]["drought_risk"] = "low"
        elif "moderate rainfall" in lower or "average rainfall" in lower:
            extracted["climate"]["rainfall"] = "moderate"
            
        rain_num = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(?:mm|millimeters)', lower)
        if rain_num:
            try:
                extracted["climate"]["rainfall_annual_mm"] = float(rain_num.group(1))
            except ValueError:
                pass

        # Region
        if "semi-arid" in lower or "semi arid" in lower:
            extracted["region"] = "semi-arid"
            extracted["climate_zone"] = "semi-arid"
        elif "tropical" in lower:
            extracted["region"] = "tropical"
            extracted["climate_zone"] = "tropical"
        elif "temperate" in lower:
            extracted["region"] = "temperate"
            extracted["climate_zone"] = "temperate"
        elif "mediterranean" in lower:
            extracted["region"] = "mediterranean"
            extracted["climate_zone"] = "mediterranean"
        elif "arid" in lower:
            extracted["region"] = "arid"
            extracted["climate_zone"] = "arid"

        # 3. Land Use
        crops = ["wheat", "corn", "maize", "rice", "cotton", "soybean", "barley", "canola", "sugarcane", "coffee", "millet"]
        for c in crops:
            if re.search(rf'\b{c}\b', lower):
                extracted["land_use"]["crop"] = c
                extracted["land_use"]["type"] = "agriculture"
                break
                
        if "monoculture" in lower:
            extracted["land_use"]["management"] = "monoculture"
            extracted["land_use"]["type"] = "agriculture"
        elif "polyculture" in lower or "intercropping" in lower:
            extracted["land_use"]["management"] = "polyculture"
            extracted["land_use"]["type"] = "agriculture"
        elif "agroforestry" in lower:
            extracted["land_use"]["management"] = "agroforestry"
            extracted["land_use"]["type"] = "agroforestry"

        if "fragmented" in lower or "fragmentation" in lower:
            extracted["land_use"]["fragmentation"] = "high"

        # 4. Biodiversity
        if "pollinators declining" in lower or "no pollinators" in lower or "low pollinator" in lower or "few bees" in lower:
            extracted["biodiversity"]["pollinator_presence"] = "scarce"
        elif "abundant pollinators" in lower or "many bees" in lower:
            extracted["biodiversity"]["pollinator_presence"] = "abundant"
            
        if "low species richness" in lower or "declining biodiversity" in lower or "species loss" in lower or "biodiversity is declining" in lower:
            extracted["biodiversity"]["species_richness"] = "low"
            extracted["biodiversity"]["habitat_diversity"] = "low"

        # 5. Human Impact
        if "high pesticide" in lower or "heavy pesticide" in lower or ("pesticides" in lower and "high" in lower):
            extracted["human_impact"]["pesticide_pressure"] = "high"
        elif "no pesticide" in lower or "organic" in lower:
            extracted["human_impact"]["pesticide_pressure"] = "none"
            
        if "deforestation" in lower:
            extracted["human_impact"]["deforestation"] = "moderate"

        # 6. Geo-coordinates
        lat_match = re.search(r'(?:lat|latitude)\s*(?:is|=|:)?\s*(-?[0-9]+(?:\.[0-9]+)?)', lower)
        lon_match = re.search(r'(?:lon|long|longitude)\s*(?:is|=|:)?\s*(-?[0-9]+(?:\.[0-9]+)?)', lower)
        if lat_match:
            try:
                extracted["latitude"] = float(lat_match.group(1))
            except ValueError:
                pass
        if lon_match:
            try:
                extracted["longitude"] = float(lon_match.group(1))
            except ValueError:
                pass
                
        cleaned = {}
        for k, v in extracted.items():
            if isinstance(v, dict):
                if any(val is not None for val in v.values()):
                    cleaned[k] = v
            elif v is not None:
                cleaned[k] = v

        return cleaned

    def merge_profiles(self, existing: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
        merged = dict(existing)
        for key, val in updates.items():
            if isinstance(val, dict) and key in merged and isinstance(merged[key], dict):
                merged[key] = {**merged[key], **val}
            else:
                merged[key] = val
        return merged

variable_extractor = VariableExtractor()

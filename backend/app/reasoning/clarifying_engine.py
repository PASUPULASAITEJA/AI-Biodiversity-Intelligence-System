from typing import Dict, Any, List

class ClarifyingQuestionEngine:
    def evaluate_missing_parameters(self, profile: Dict[str, Any], user_message: str) -> List[str]:
        questions: List[str] = []
        
        soil = profile.get("soil", {})
        land_use = profile.get("land_use", {})
        climate = profile.get("climate", {})
        biodiv = profile.get("biodiversity", {})
        human = profile.get("human_impact", {})
        region = profile.get("region")
        
        has_soc = soil.get("organic_carbon") is not None or profile.get("soil_organic_carbon_pct") is not None
        has_rainfall = climate.get("rainfall") is not None or climate.get("rainfall_annual_mm") is not None or profile.get("avg_rainfall_mm") is not None or profile.get("rainfall") is not None
        has_land_use = land_use.get("crop") is not None or land_use.get("type") is not None or land_use.get("management") is not None or profile.get("crop") is not None or profile.get("land_use") is not None
        has_region = region is not None or profile.get("region_climate_zone") is not None
        has_pollinators = biodiv.get("pollinator_presence") is not None or biodiv.get("species_richness") is not None
        has_pesticides = human.get("pesticide_pressure") is not None
        
        known_count = sum([has_soc, has_rainfall, has_land_use, has_region, has_pollinators])
        
        if known_count < 3:
            if not has_soc:
                questions.append("What is your approximate Soil Organic Carbon (SOC %) or topsoil organic matter status?")
            if not has_land_use:
                questions.append("What type of land use or crop management system are you currently operating (e.g., monoculture wheat, agroforestry, pasture)?")
            if not has_rainfall:
                questions.append("How would you describe your precipitation regime (e.g., low/arid, moderate, high, or annual mm)?")
            if not has_region:
                questions.append("What geographic region or agro-climatic zone is your land located in (e.g., semi-arid, temperate, tropical)?")
            if not has_pollinators:
                questions.append("Have you noticed specific declines in wild pollinators, beneficial insects, or native vegetation?")
            if not has_pesticides and known_count >= 1:
                questions.append("Are synthetic pesticides, herbicides, or intensive fertilizers frequently applied on or near the site?")
                
        return questions[:5]

clarifying_engine = ClarifyingQuestionEngine()

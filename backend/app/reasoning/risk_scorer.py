from typing import Dict, Any, List
from app.models.schemas import RiskAssessment, RiskBreakdown

class RiskScorer:
    def calculate_risk(self, profile: Dict[str, Any]) -> RiskAssessment:
        soil = profile.get("soil", {})
        land_use = profile.get("land_use", {})
        climate = profile.get("climate", {})
        biodiv = profile.get("biodiversity", {})
        human = profile.get("human_impact", {})
        
        breakdowns: List[RiskBreakdown] = []
        primary_drivers: List[str] = []
        secondary_drivers: List[str] = []
        
        # 1. Soil Degradation Score (0 - 100)
        soil_score = 30
        soc = soil.get("organic_carbon")
        ph = soil.get("ph")
        
        if soc is not None:
            if soc < 0.5:
                soil_score += 45
                primary_drivers.append(f"Severely depleted soil organic carbon ({soc}%)")
            elif soc < 1.0:
                soil_score += 30
                primary_drivers.append(f"Sub-optimal soil organic carbon ({soc}%)")
            elif soc > 3.0:
                soil_score -= 20
        else:
            soil_score += 10
            
        if ph is not None:
            if ph < 5.5 or ph > 8.5:
                soil_score += 20
                secondary_drivers.append(f"Sub-optimal soil pH ({ph}) restricting nutrient availability")
                
        soil_score = max(5, min(95, soil_score))
        breakdowns.append(RiskBreakdown(
            category="Soil Degradation",
            score=soil_score,
            level=self._get_level(soil_score),
            explanation=f"Soil degradation index based on SOC ({soc if soc is not None else 'unknown'}%) and pH stability."
        ))

        # 2. Biodiversity Loss Score (0 - 100)
        bio_score = 35
        species = biodiv.get("species_richness")
        pollinators = biodiv.get("pollinator_presence")
        mgmt = land_use.get("management")
        
        if species in ["low", "very_low"]:
            bio_score += 35
            primary_drivers.append("Low observed species richness and habitat diversity")
        if pollinators in ["scarce", "absent"]:
            bio_score += 25
            primary_drivers.append("Depleted pollinator presence and floral resource dearth")
        if mgmt == "monoculture":
            bio_score += 20
            primary_drivers.append("Continuous monoculture cropping suppressing ecosystem heterogeneity")
        elif mgmt in ["polyculture", "agroforestry"]:
            bio_score -= 25
            
        bio_score = max(5, min(95, bio_score))
        breakdowns.append(RiskBreakdown(
            category="Biodiversity Loss",
            score=bio_score,
            level=self._get_level(bio_score),
            explanation="Ecological risk evaluating species richness, floral diversity, and pollinator abundance."
        ))

        # 3. Climate Vulnerability & Water Stress Score (0 - 100)
        clim_score = 30
        rainfall = climate.get("rainfall")
        drought = climate.get("drought_risk")
        
        if rainfall == "low" or drought in ["high", "severe"]:
            clim_score += 40
            primary_drivers.append("Low precipitation regime and elevated drought risk")
        elif rainfall == "erratic":
            clim_score += 25
            secondary_drivers.append("Erratic rainfall patterns causing seasonal water stress")
            
        if soc is not None and soc < 1.0 and rainfall == "low":
            clim_score += 15
            primary_drivers.append("Compounded vulnerability: low rainfall combined with low SOC water retention")
            
        clim_score = max(5, min(95, clim_score))
        breakdowns.append(RiskBreakdown(
            category="Climate & Water Stress",
            score=clim_score,
            level=self._get_level(clim_score),
            explanation="Vulnerability assessment integrating rainfall availability, drought recurrence, and moisture buffer."
        ))

        # 4. Human & Agricultural Pressure Score (0 - 100)
        human_score = 25
        pesticide = human.get("pesticide_pressure")
        deforest = human.get("deforestation")
        frag = land_use.get("fragmentation")
        
        if pesticide in ["high", "intensive"]:
            human_score += 40
            secondary_drivers.append(f"{pesticide.capitalize()} synthetic pesticide application suppressing non-target fauna")
        elif pesticide == "moderate":
            human_score += 20
            secondary_drivers.append("Moderate pesticide usage creating chemical pressure on microbiome")
            
        if deforest in ["moderate", "severe"]:
            human_score += 25
            secondary_drivers.append("Canopy cover loss and deforestation edge disturbances")
            
        if frag in ["high", "severe"]:
            human_score += 20
            secondary_drivers.append("High landscape fragmentation isolating core biological patches")

        human_score = max(5, min(95, human_score))
        breakdowns.append(RiskBreakdown(
            category="Human & Chemical Pressure",
            score=human_score,
            level=self._get_level(human_score),
            explanation="Anthropic stress score reflecting chemical pesticide inputs, fragmentation, and land-use intensity."
        ))

        overall_score = int(round(
            0.30 * soil_score +
            0.30 * bio_score +
            0.25 * clim_score +
            0.15 * human_score
        ))
        
        if not primary_drivers and not secondary_drivers:
            if soc is not None and soc >= 2.0:
                primary_drivers.append(f"Favorable soil organic carbon stock ({soc}%) supporting biological aggregate stability")
            if biodiv.get("species_richness") == "high" or biodiv.get("pollinator_presence") == "abundant":
                primary_drivers.append("High biodiversity integrity and active pollinator guild connectivity")
            if human.get("water_extraction") in ["high", "depleted"]:
                primary_drivers.append("High water table extraction and coastal aquifer pressure")
            if not primary_drivers:
                primary_drivers.append("Stable baseline environmental conditions under ongoing monitoring")
                
        primary_drivers = list(dict.fromkeys(primary_drivers))
        secondary_drivers = list(dict.fromkeys(secondary_drivers))
        
        return RiskAssessment(
            overall_score=overall_score,
            risk_level=self._get_level(overall_score),
            primary_drivers=primary_drivers[:4],
            secondary_drivers=secondary_drivers[:4],
            category_breakdowns=breakdowns,
            uncertainty_level="Low" if len(profile.keys()) >= 4 else "Moderate"
        )

    def _get_level(self, score: int) -> str:
        if score >= 75:
            return "Critical"
        elif score >= 55:
            return "High"
        elif score >= 35:
            return "Moderate"
        return "Low"

risk_scorer = RiskScorer()

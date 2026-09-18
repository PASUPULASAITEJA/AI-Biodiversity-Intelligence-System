from typing import Dict, Any, List
from app.models.schemas import CausalLink

class CausalGraphEngine:
    def trace_causal_chains(self, profile: Dict[str, Any]) -> List[CausalLink]:
        links: List[CausalLink] = []
        
        soil = profile.get("soil", {})
        land_use = profile.get("land_use", {})
        climate = profile.get("climate", {})
        biodiv = profile.get("biodiversity", {})
        human = profile.get("human_impact", {})
        
        soc = soil.get("organic_carbon")
        rainfall = climate.get("rainfall")
        management = land_use.get("management")
        pesticide = human.get("pesticide_pressure")
        fragmentation = land_use.get("fragmentation")
        land_type = land_use.get("type")
        
        # 1. Low SOC Causal Chain
        if soc is not None and soc < 1.0:
            links.append(CausalLink(
                source="Low Soil Organic Carbon (<1.0%)",
                target="Degraded Soil Aggregate Stability",
                mechanism="Insufficient fungal hyphae and microbial glomalin weaken mineral binding, causing surface crusting.",
                impact_direction="negative"
            ))
            links.append(CausalLink(
                source="Degraded Soil Aggregate Stability",
                target="Reduced Water Infiltration & Storage",
                mechanism="Pores seal during rainfall, increasing erosive surface runoff and lowering subsoil moisture retention.",
                impact_direction="negative"
            ))
            links.append(CausalLink(
                source="Reduced Water Infiltration & Storage",
                target="Vegetation & Crop Water Stress",
                mechanism="Shallower root hydration triggers premature stomatal closure and limits nutrient uptake.",
                impact_direction="negative"
            ))
            links.append(CausalLink(
                source="Vegetation & Crop Water Stress",
                target="Subterranean & Epigeal Biodiversity Decline",
                mechanism="Loss of root exudates and soil moisture starves micro-arthropods and beneficial mycorrhizae.",
                impact_direction="negative"
            ))

        # 2. Monoculture Causal Chain
        if management == "monoculture" or (land_type == "agriculture" and management != "polyculture" and management != "agroforestry"):
            links.append(CausalLink(
                source="Crop Monoculture",
                target="Habitat Heterogeneity Collapse",
                mechanism="Uniform canopy structure and synchronized flowering eliminate varied food and nesting niches.",
                impact_direction="negative"
            ))
            links.append(CausalLink(
                source="Habitat Heterogeneity Collapse",
                target="Pollinator & Natural Predator Depletion",
                mechanism="Lack of continuous floral bloom periods causes severe nutritional dearth for solitary bees and predatory wasps.",
                impact_direction="negative"
            ))
            links.append(CausalLink(
                source="Pollinator & Natural Predator Depletion",
                target="Pest Resurgence & Trophic Vulnerability",
                mechanism="Disrupted top-down biocontrol increases crop vulnerability to pest outbreaks.",
                impact_direction="negative"
            ))

        # 3. Low Rainfall + Low SOC Compounding Interaction
        if rainfall == "low" and (soc is not None and soc < 1.0):
            links.append(CausalLink(
                source="Compound Deficit (Low Rainfall + Low SOC)",
                target="Amplified Drought Sensitivity",
                mechanism="Atmospheric moisture deficit is compounded by zero soil water buffer, accelerating land degradation.",
                impact_direction="negative"
            ))

        # 4. Pesticide Pressure
        if pesticide in ["high", "intensive", "moderate"]:
            links.append(CausalLink(
                source=f"{pesticide.capitalize()} Pesticide Pressure",
                target="Non-Target Entomofauna Mortality",
                mechanism="Broad-spectrum synthetic chemicals decimate wild pollinator populations and beneficial parasitoids.",
                impact_direction="negative"
            ))

        # 5. Habitat Fragmentation
        if fragmentation in ["high", "severe"]:
            links.append(CausalLink(
                source="Habitat Fragmentation",
                target="Metapopulation Disconnection",
                mechanism="Barriers to genetic flow increase inbreeding depression and local extinction risk among native fauna.",
                impact_direction="negative"
            ))

        return links

    def generate_auditable_summary(self, links: List[CausalLink], profile: Dict[str, Any]) -> List[str]:
        steps = []
        soil = profile.get("soil", {})
        soc = soil.get("organic_carbon")
        rain = profile.get("climate", {}).get("rainfall")
        mgmt = profile.get("land_use", {}).get("management")
        
        if soc is not None:
            steps.append(f"Soil organic carbon is measured at {soc}%, which is {'critically low (<1.0%)' if soc < 1.0 else 'moderate/adequate'}.")
        if rain:
            steps.append(f"Rainfall availability is classified as {rain}.")
        if mgmt:
            steps.append(f"Land is managed under {mgmt} regime.")
            
        for idx, link in enumerate(links[:4], 1):
            steps.append(f"{link.source} drives {link.target} because {link.mechanism.lower()}")
            
        steps.append("Interventions must simultaneously regenerate soil hydrology and establish multi-species habitat connectivity.")
        return steps

causal_graph_engine = CausalGraphEngine()

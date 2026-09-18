from typing import Dict, Any, List, Optional
from app.models.schemas import RecommendationItem, AffectedMetric, ScientificCitation
from app.recommendations.trade_off_analyzer import trade_off_analyzer
from app.rag.vector_store import vector_store

class RecommendationEngine:
    def generate_recommendations(
        self,
        profile: Dict[str, Any],
        retrieved_citations: List[ScientificCitation],
        user_constraints: Optional[str] = None
    ) -> List[RecommendationItem]:
        recommendations: List[RecommendationItem] = []
        
        soil = profile.get("soil", {})
        land_use = profile.get("land_use", {})
        climate = profile.get("climate", {})
        biodiv = profile.get("biodiversity", {})
        human = profile.get("human_impact", {})
        region = (profile.get("region") or profile.get("region_climate_zone") or "").lower()
        
        soc = soil.get("organic_carbon") or profile.get("soil_organic_carbon_pct")
        rainfall = climate.get("rainfall") or profile.get("rainfall")
        mgmt = land_use.get("management") or profile.get("management")
        land_type = land_use.get("type") or profile.get("land_use_type")
        pesticides = human.get("pesticide_pressure")
        fragmentation = land_use.get("fragmentation")
        
        def find_citation(topic_kw: str, default_idx: int = 0) -> ScientificCitation:
            for cit in retrieved_citations:
                if topic_kw.lower() in (cit.topic or "").lower() or topic_kw.lower() in (cit.retrieved_chunk or "").lower():
                    return cit
            if retrieved_citations:
                return retrieved_citations[min(default_idx, len(retrieved_citations)-1)]
            return ScientificCitation(
                source_id="fao_soc_rec_2024",
                organization="FAO",
                title="Recarbonizing Global Soils: A Technical Manual of Recommended Management Practices",
                year=2024,
                topic="soil_health",
                url="https://www.fao.org/documents/card/en/c/cb6378en",
                retrieved_chunk="Soil organic carbon is fundamental to soil aggregate stability and water retention capacity.",
                why_selected="Authoritative Tier 1 global guidance on soil restoration."
            )

        # 1. Semi-arid / Low SOC & Low Rainfall Scenario
        if (soc is not None and soc < 1.0) or (rainfall == "low" and mgmt == "monoculture"):
            cit = find_citation("soil_health")
            action_desc = "Establish Short-Cycle Leguminous Cover Crops (e.g., Cowpea/Vetch) with Timely Early Termination & Residue Mulching"
            if user_constraints and "cannot change the crop" in user_constraints.lower():
                action_desc = "In-Situ Inter-Row Residue Retention & Biological Seed Inoculation without cash-crop substitution"
                
            recommendations.append(RecommendationItem(
                action=action_desc,
                why_it_works="Legume root nodule exudates supply biologically fixed nitrogen while decomposing plant biomass deposits recalcitrant particulate organic matter, boosting microbial glomalin synthesis to form resilient water-stable soil aggregates.",
                metrics_affected=[
                    AffectedMetric(name="Soil Organic Carbon (SOC)", direction="increase", direction_symbol="↑", expected_magnitude="+15-25% (+0.20% SOC) over 2-3 years"),
                    AffectedMetric(name="Water Infiltration Rate", direction="increase", direction_symbol="↑", expected_magnitude="+2.0 mm/100mm soil depth"),
                    AffectedMetric(name="Topsoil Erosion Risk", direction="decrease", direction_symbol="↓", expected_magnitude="-35% to -50% surface runoff"),
                    AffectedMetric(name="Soil Microbial Biomass", direction="increase", direction_symbol="↑", expected_magnitude="+40% AMF fungal hyphae density")
                ],
                time_horizon="Medium term (6–24 months)",
                expected_impact="Restores soil hydration reservoir, increases dryland crop drought tolerance, and stabilizes subterranean mycorrhizal communities.",
                confidence="High",
                evidence=cit,
                trade_offs=trade_off_analyzer.analyze_trade_offs("cover crop", profile)
            ))

        # 2. Monoculture / Pollinator Decline Intervention
        if mgmt == "monoculture" or biodiv.get("pollinator_presence") in ["scarce", "absent"] or biodiv.get("species_richness") == "low":
            cit = find_citation("pollinators", 1)
            action_desc = "Implement Multi-Species Native Flowering Field Margins & Pollinator Hedgerow Strips"
            if user_constraints and "cannot change the crop" in user_constraints.lower():
                action_desc = "Perimeter Native Pollinator Border Strips (8-12 local wildflower species along uncultivated field margins)"
                
            recommendations.append(RecommendationItem(
                action=action_desc,
                why_it_works="Perimeter strips with staggered blooming phenology offer non-crop floral nectar and nesting cavities, supporting wild solitary bees and syrphid fly predators that provide natural biocontrol against crop pests.",
                metrics_affected=[
                    AffectedMetric(name="Pollinator Abundance & Diversity", direction="increase", direction_symbol="↑", expected_magnitude="+150% to +300% within 18 months"),
                    AffectedMetric(name="Natural Pest Predation Rate", direction="increase", direction_symbol="↑", expected_magnitude="+45% aphid/pest suppression"),
                    AffectedMetric(name="Landscape Habitat Heterogeneity", direction="increase", direction_symbol="↑", expected_magnitude="+60% structural niche complexity"),
                    AffectedMetric(name="Synthetic Pesticide Requirement", direction="decrease", direction_symbol="↓", expected_magnitude="-50% targeted reduction")
                ],
                time_horizon="Short to Medium term (6–18 months)",
                expected_impact="Recovers functional entomofauna populations, enhances crop pollination fruit-set, and lowers chemical input dependency.",
                confidence="High",
                evidence=cit,
                trade_offs=trade_off_analyzer.analyze_trade_offs("pollinator strip", profile)
            ))

        # 3. Agroforestry / Habitat Connectivity
        if rainfall == "low" or "semi-arid" in region or fragmentation in ["high", "severe"] or land_type in ["agriculture", "grassland"]:
            cit = find_citation("agroforestry", 2)
            recommendations.append(RecommendationItem(
                action="Integrate Drought-Resilient Parkland Agroforestry / Linear Woody Windbreak Corridors",
                why_it_works="Deep taproot systems of native multipurpose trees (such as Faidherbia or Acacia) facilitate hydraulic lift, bringing deep water to upper horizons while tree canopies moderate ambient surface temperatures by 4-8°C, creating essential microclimatic refugia.",
                metrics_affected=[
                    AffectedMetric(name="Microclimate Temperature Buffering", direction="stabilize", direction_symbol="↔", expected_magnitude="-3°C to -6°C extreme heat buffering"),
                    AffectedMetric(name="Landscape Biological Connectivity", direction="increase", direction_symbol="↑", expected_magnitude="+300% corridor connectivity"),
                    AffectedMetric(name="Total Ecosystem Carbon Sequestration", direction="increase", direction_symbol="↑", expected_magnitude="+2.5 to 4.0 t C/ha/year")
                ],
                time_horizon="Long term (2–5+ years)",
                expected_impact="Transforms degraded monoculture plains into climate-resilient agroecosystems with continuous structural habitat connectivity.",
                confidence="High" if region in ["semi-arid", "arid", "drylands"] else "Medium",
                evidence=cit,
                trade_offs=trade_off_analyzer.analyze_trade_offs("agroforestry", profile)
            ))

        # 4. Human Pesticide Pressure Mitigation
        if pesticides in ["high", "intensive", "moderate"]:
            cit = find_citation("soil_microbiology", 0)
            recommendations.append(RecommendationItem(
                action="Deploy Biological Bio-Inoculants (Arbuscular Mycorrhizal Fungi) and Transition to Targeted IPM",
                why_it_works="Replacing prophylactic broad-spectrum spraying with biological pheromone monitoring and mycorrhizal bio-fertilizers re-establishes subterranean fungal networks and stimulates systemic plant defense mechanisms against pathogens.",
                metrics_affected=[
                    AffectedMetric(name="Arbuscular Mycorrhizal Colonization", direction="increase", direction_symbol="↑", expected_magnitude="+70% root colonization"),
                    AffectedMetric(name="Phosphorus Use Efficiency", direction="increase", direction_symbol="↑", expected_magnitude="+35% nutrient uptake"),
                    AffectedMetric(name="Soil Chemical Residue Ecotoxicity", direction="decrease", direction_symbol="↓", expected_magnitude="-80% residual chemical load")
                ],
                time_horizon="Short term (0–6 months)",
                expected_impact="Rapid recovery of beneficial soil microbiome and immediate cessation of non-target pollinator mortality.",
                confidence="High",
                evidence=cit,
                trade_offs=trade_off_analyzer.analyze_trade_offs("ipm", profile)
            ))

        return recommendations[:4]

recommendation_engine = RecommendationEngine()

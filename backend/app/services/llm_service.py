from typing import Dict, Any, List
from app.models.schemas import RecommendationItem, ScientificCitation, RiskAssessment, CausalLink

class LLMService:
    async def synthesize_scientific_response(
        self,
        user_message: str,
        profile: Dict[str, Any],
        risk_assessment: RiskAssessment,
        causal_links: List[CausalLink],
        recommendations: List[RecommendationItem],
        citations: List[ScientificCitation],
        is_clarifying: bool,
        clarifying_questions: List[str]
    ) -> str:
        if is_clarifying and clarifying_questions:
            q_bullets = "\n".join([f"{i+1}. {q}" for i, q in enumerate(clarifying_questions)])
            return (
                f"I can thoroughly analyze the biodiversity dynamics on your land, but I need a few key environmental baseline variables to accurately identify the underlying drivers and model the ecological interactions.\n\n"
                f"{q_bullets}\n\n"
                f"*Once you provide these parameters, I will construct a multi-metric causal assessment, calculate your transparent risk score, and retrieve grounded scientific interventions.*"
            )

        soc = profile.get("soil", {}).get("organic_carbon") or profile.get("soil_organic_carbon_pct")
        rainfall = profile.get("climate", {}).get("rainfall") or profile.get("rainfall")
        mgmt = profile.get("land_use", {}).get("management") or profile.get("management")
        crop = profile.get("land_use", {}).get("crop") or profile.get("crop")
        region = profile.get("region") or profile.get("region_climate_zone", "specified zone")
        
        assessment_text = f"The landscape in {region} exhibits an overall Environmental Risk Score of **{risk_assessment.overall_score}/100 ({risk_assessment.risk_level})**. "
        if soc is not None:
            assessment_text += f"Soil Organic Carbon is at {soc}%, indicating {'severe biological depletion' if soc < 1.0 else 'moderate stability'}. "
        if rainfall:
            assessment_text += f"Precipitation regime is {rainfall}, elevating systemic drought sensitivity. "
        if mgmt or crop:
            assessment_text += f"Cropping is structured as {mgmt or 'cultivated'} {crop or 'cropland'}. "

        drivers_text = "\n".join([f"• **{d}**" for d in risk_assessment.primary_drivers])
        if risk_assessment.secondary_drivers:
            drivers_text += "\n" + "\n".join([f"• {d}" for d in risk_assessment.secondary_drivers])

        rec_blocks = []
        for idx, rec in enumerate(recommendations, 1):
            metrics_list = "\n".join([f"  * {m.name} {m.direction_symbol} ({m.expected_magnitude or m.direction})" for m in rec.metrics_affected])
            cit_tag = f"{rec.evidence.organization}, {rec.evidence.year} — *\"{rec.evidence.title}\"*"
            
            block = (
                f"### Recommendation {idx}: {rec.action}\n\n"
                f"**Action:** {rec.action}\n\n"
                f"**Why it works:** {rec.why_it_works}\n\n"
                f"**Metrics affected:**\n{metrics_list}\n\n"
                f"**Time horizon:** {rec.time_horizon}\n\n"
                f"**Expected impact:** {rec.expected_impact}\n\n"
                f"**Confidence:** {rec.confidence}\n\n"
                f"**Evidence:** [{rec.evidence.organization}, {rec.evidence.year}] ({cit_tag})\n\n"
                f"**Trade-offs & Considerations:** {rec.trade_offs or 'Monitor seasonal soil moisture.'}"
            )
            rec_blocks.append(block)

        recs_formatted = "\n\n---\n\n".join(rec_blocks)

        interactions = (
            "Soil Organic Carbon, soil aggregate structure, and hydraulic infiltration operate as a tightly coupled positive feedback loop. "
            "Depleted organic matter (<1.0%) collapses pore geometry, accelerating surface runoff and cutting infiltration during rainfall events. "
            "This moisture deficit triggers vegetation water stress, which sharply limits floral nectar production and canopy heterogeneity—directly driving pollinator collapse and species richness decline."
        )

        trade_offs = (
            "While establishing cover crops and pollinator strips restores biodiversity and aggregate stability, in semi-arid zones early termination is crucial to prevent vegetative water competition with subsequent cash crops. "
            "Diversification should be introduced through phased perimeter corridors to preserve baseline mechanical harvest pathways."
        )

        final_response = f"""## Environmental Assessment
{assessment_text}

## Key Drivers
{drivers_text}

## Recommended Actions
{recs_formatted}

---

## Interaction Between Metrics
{interactions}

---

## Risks / Trade-offs
{trade_offs}
"""
        return final_response.strip()

llm_service = LLMService()

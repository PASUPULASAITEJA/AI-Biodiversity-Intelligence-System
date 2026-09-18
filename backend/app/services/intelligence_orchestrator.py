from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.schemas import (
    EnvironmentalProfileSchema,
    RiskAssessment,
    RecommendationItem,
    ScientificCitation,
    ReasoningTrace,
    AffectedMetric,
    ChatResponse,
    AnalyzeResponse
)
from app.reasoning.variable_extractor import variable_extractor
from app.reasoning.validator import validator
from app.reasoning.uncertainty_tracker import uncertainty_tracker
from app.reasoning.causal_graph import causal_graph_engine
from app.reasoning.risk_scorer import risk_scorer
from app.reasoning.clarifying_engine import clarifying_engine
from app.recommendations.engine import recommendation_engine
from app.rag.vector_store import vector_store
from app.services.conversation_service import conversation_service
from app.services.llm_service import llm_service

class IntelligenceOrchestrator:
    async def process_chat(
        self,
        db: Session,
        message: str,
        conversation_id: Optional[str] = None,
        structured_override: Optional[Dict[str, Any]] = None
    ) -> ChatResponse:
        conversation = conversation_service.get_or_create_conversation(db, conversation_id)
        
        extracted = variable_extractor.extract_from_text(message)
        if structured_override:
            extracted = variable_extractor.merge_profiles(extracted, structured_override)
            
        is_valid, validation_warnings = validator.validate_inputs(extracted)
        
        profile_record = conversation_service.update_profile(db, conversation, extracted)
        current_profile_data = profile_record.profile_data or {}
        
        clarifying_questions = clarifying_engine.evaluate_missing_parameters(current_profile_data, message)
        is_clarifying = len(clarifying_questions) > 0 and len(current_profile_data.keys()) < 3
        
        causal_links = causal_graph_engine.trace_causal_chains(current_profile_data)
        risk_assessment = risk_scorer.calculate_risk(current_profile_data)
        known, estimated, unknown, confidence_level = uncertainty_tracker.evaluate_uncertainty(current_profile_data)
        
        target_vars = []
        for cat, data in current_profile_data.items():
            if isinstance(data, dict):
                target_vars.extend(list(data.keys()))
            else:
                target_vars.append(cat)
                
        retrieval_query = f"{message} {' '.join(target_vars)} {current_profile_data.get('region', '')}"
        citations = vector_store.search(
            query=retrieval_query,
            target_variables=target_vars,
            top_k=4
        )
        
        recommendations = []
        if not is_clarifying or len(current_profile_data.keys()) >= 2:
            recommendations = recommendation_engine.generate_recommendations(
                profile=current_profile_data,
                retrieved_citations=citations,
                user_constraints=message
            )
            conversation_service.save_recommendations(db, conversation.id, recommendations)
            conversation_service.save_retrieval_logs(db, conversation.id, retrieval_query, citations)
            
        ai_message = await llm_service.synthesize_scientific_response(
            user_message=message,
            profile=current_profile_data,
            risk_assessment=risk_assessment,
            causal_links=causal_links,
            recommendations=recommendations,
            citations=citations,
            is_clarifying=is_clarifying,
            clarifying_questions=clarifying_questions
        )
        
        conversation_service.add_message(db, conversation.id, "user", message, structured_override)
        conversation_service.add_message(db, conversation.id, "assistant", ai_message)
        
        steps = causal_graph_engine.generate_auditable_summary(causal_links, current_profile_data)
        reasoning_trace = ReasoningTrace(
            summary_steps=steps,
            causal_chains=causal_links,
            known_variables=known,
            estimated_variables=estimated,
            unknown_variables=unknown,
            auditable_summary="\n".join([f"{i+1}. {s}" for i, s in enumerate(steps)])
        )

        return ChatResponse(
            conversation_id=conversation.id,
            message=ai_message,
            is_clarifying=is_clarifying,
            clarifying_questions=clarifying_questions,
            detected_variables=extracted,
            environmental_profile=EnvironmentalProfileSchema(**current_profile_data),
            risk_assessment=risk_assessment,
            recommendations=recommendations if recommendations else None,
            sources=citations if citations else None,
            reasoning_trace=reasoning_trace,
            validation_warnings=validation_warnings
        )

    async def process_analysis(
        self,
        db: Session,
        message: Optional[str],
        environment: Optional[Dict[str, Any]],
        conversation_id: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> AnalyzeResponse:
        conversation = conversation_service.get_or_create_conversation(db, conversation_id)
        
        input_env = environment or {}
        if latitude is not None:
            input_env["latitude"] = latitude
        if longitude is not None:
            input_env["longitude"] = longitude
            
        structured_env: Dict[str, Any] = {
            "soil": {},
            "land_use": {},
            "climate": {},
            "biodiversity": {},
            "human_impact": {}
        }
        
        if "soil_organic_carbon" in input_env or "soil_organic_carbon_pct" in input_env:
            structured_env["soil"]["organic_carbon"] = float(input_env.get("soil_organic_carbon", input_env.get("soil_organic_carbon_pct")))
        if "soil_ph" in input_env:
            structured_env["soil"]["ph"] = float(input_env["soil_ph"])
        if "soil_moisture" in input_env:
            structured_env["soil"]["moisture"] = input_env["soil_moisture"]
            
        if "crop" in input_env:
            structured_env["land_use"]["crop"] = input_env["crop"]
            structured_env["land_use"]["type"] = "agriculture"
        if "land_use" in input_env or "land_use_type" in input_env:
            val = input_env.get("land_use", input_env.get("land_use_type"))
            if val in ["monoculture", "polyculture", "agroforestry"]:
                structured_env["land_use"]["management"] = val
                structured_env["land_use"]["type"] = "agriculture"
            else:
                structured_env["land_use"]["type"] = val
        if "management" in input_env:
            structured_env["land_use"]["management"] = input_env["management"]
            
        if "rainfall" in input_env or "rainfall_condition" in input_env:
            structured_env["climate"]["rainfall"] = input_env.get("rainfall", input_env.get("rainfall_condition"))
        if "drought_risk" in input_env:
            structured_env["climate"]["drought_risk"] = input_env["drought_risk"]
            
        if "region" in input_env or "region_climate_zone" in input_env:
            structured_env["region"] = input_env.get("region", input_env.get("region_climate_zone"))
            
        for cat in ["soil", "land_use", "climate", "biodiversity", "human_impact"]:
            if cat in input_env and isinstance(input_env[cat], dict):
                structured_env[cat] = {**structured_env[cat], **input_env[cat]}

        if message:
            text_extracted = variable_extractor.extract_from_text(message)
            structured_env = variable_extractor.merge_profiles(structured_env, text_extracted)
            
        validator.validate_inputs(structured_env)
        
        profile_record = conversation_service.update_profile(db, conversation, structured_env)
        active_profile = profile_record.profile_data or {}
        
        risk = risk_scorer.calculate_risk(active_profile)
        causal_links = causal_graph_engine.trace_causal_chains(active_profile)
        known, estimated, unknown, confidence = uncertainty_tracker.evaluate_uncertainty(active_profile)
        
        citations = vector_store.search(
            query=f"{message or ''} {active_profile.get('region', '')} soil carbon biodiversity",
            target_variables=list(active_profile.keys()),
            top_k=4
        )
        
        recs = recommendation_engine.generate_recommendations(active_profile, citations, message)
        conversation_service.save_recommendations(db, conversation.id, recs)
        
        all_affected: List[AffectedMetric] = []
        for r in recs:
            all_affected.extend(r.metrics_affected)
            
        clarifying_qs = clarifying_engine.evaluate_missing_parameters(active_profile, message or "")
        
        assessment = f"Comprehensive multi-metric assessment identified an Environmental Risk Score of {risk.overall_score}/100 ({risk.risk_level}). Primary ecosystem degradation drivers include {', '.join(risk.primary_drivers[:3])}."
        
        reasoning_steps = causal_graph_engine.generate_auditable_summary(causal_links, active_profile)
        reasoning_trace = ReasoningTrace(
            summary_steps=reasoning_steps,
            causal_chains=causal_links,
            known_variables=known,
            estimated_variables=estimated,
            unknown_variables=unknown,
            auditable_summary="\n".join([f"{i+1}. {s}" for i, s in enumerate(reasoning_steps)])
        )

        return AnalyzeResponse(
            conversation_id=conversation.id,
            assessment=assessment,
            risk_score=risk.overall_score,
            risk_level=risk.risk_level,
            risk_assessment=risk,
            key_drivers=risk.primary_drivers + risk.secondary_drivers,
            recommendations=recs,
            affected_metrics=all_affected,
            metric_interactions="Soil Organic Carbon and aggregate stability directly govern infiltration efficiency, microclimate moderation, and continuous floral nectar subsidies for pollinator guilds.",
            trade_offs_summary="Cover crops and perennial borders provide substantial biodiversity regeneration, with moisture competition in semi-arid zones mitigated by early bloom termination.",
            reasoning_trace=reasoning_trace,
            time_horizon={
                "short_term": "0–6 months (Soil bio-inoculation & pollinator margin seeding)",
                "medium_term": "6–24 months (SOC aggregate formation & pest predation stabilization)",
                "long_term": "2–5+ years (Corridor connectivity & microclimatic resilience)"
            },
            confidence=confidence,
            sources=citations,
            missing_information=unknown,
            clarifying_questions=clarifying_qs,
            environmental_profile=EnvironmentalProfileSchema(**active_profile)
        )

orchestrator = IntelligenceOrchestrator()

from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime

class SoilProfile(BaseModel):
    ph: Optional[float] = None
    organic_carbon: Optional[float] = None
    moisture: Optional[str] = None
    moisture_percentage: Optional[float] = None
    nutrients: Optional[Dict[str, Any]] = Field(default_factory=dict)
    degradation_status: Optional[str] = None

class LandUseProfile(BaseModel):
    type: Optional[str] = None
    crop: Optional[str] = None
    management: Optional[str] = None
    fragmentation: Optional[str] = None
    canopy_cover_percentage: Optional[float] = None

class ClimateProfile(BaseModel):
    temperature: Optional[str] = None
    temperature_celsius: Optional[float] = None
    rainfall: Optional[str] = None
    rainfall_annual_mm: Optional[float] = None
    rainfall_variability: Optional[str] = None
    drought_risk: Optional[str] = None
    season: Optional[str] = None

class BiodiversityProfile(BaseModel):
    species_richness: Optional[str] = None
    species_count: Optional[int] = None
    habitat_diversity: Optional[str] = None
    pollinator_presence: Optional[str] = None
    native_species_ratio: Optional[float] = None
    vegetation_diversity: Optional[str] = None
    wildlife_indicators: Optional[List[str]] = Field(default_factory=list)
    habitat_connectivity: Optional[str] = None

class HumanImpactProfile(BaseModel):
    pollution: Optional[str] = None
    deforestation: Optional[str] = None
    pesticide_pressure: Optional[str] = None
    urbanization: Optional[str] = None
    water_extraction: Optional[str] = None
    habitat_destruction: Optional[str] = None

class EnvironmentalProfileSchema(BaseModel):
    region: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    climate_zone: Optional[str] = None
    soil: SoilProfile = Field(default_factory=SoilProfile)
    land_use: LandUseProfile = Field(default_factory=LandUseProfile)
    climate: ClimateProfile = Field(default_factory=ClimateProfile)
    biodiversity: BiodiversityProfile = Field(default_factory=BiodiversityProfile)
    human_impact: HumanImpactProfile = Field(default_factory=HumanImpactProfile)

class AffectedMetric(BaseModel):
    name: str
    direction: str
    direction_symbol: str = "↑"
    expected_magnitude: Optional[str] = None

class ScientificCitation(BaseModel):
    source_id: str
    organization: str
    title: str
    year: int
    topic: Optional[str] = None
    relevance_score: Optional[float] = None
    url: Optional[str] = None
    doi: Optional[str] = None
    tier: int = 1
    retrieved_chunk: Optional[str] = None
    why_selected: Optional[str] = None

class RecommendationItem(BaseModel):
    action: str
    why_it_works: str
    metrics_affected: List[AffectedMetric]
    time_horizon: str
    expected_impact: str
    confidence: str
    evidence: ScientificCitation
    trade_offs: Optional[str] = None

class RiskBreakdown(BaseModel):
    category: str
    score: int
    level: str
    explanation: str

class RiskAssessment(BaseModel):
    overall_score: int
    risk_level: str
    primary_drivers: List[str]
    secondary_drivers: List[str]
    category_breakdowns: List[RiskBreakdown]
    uncertainty_level: str

class CausalLink(BaseModel):
    source: str
    target: str
    mechanism: str
    impact_direction: str

class ReasoningTrace(BaseModel):
    summary_steps: List[str]
    causal_chains: List[CausalLink]
    known_variables: List[str]
    estimated_variables: List[str]
    unknown_variables: List[str]
    auditable_summary: str

class AnalyzeRequest(BaseModel):
    message: Optional[str] = "Environmental analysis request"
    environment: Optional[Dict[str, Any]] = None
    conversation_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class AnalyzeResponse(BaseModel):
    conversation_id: str
    assessment: str
    risk_score: int
    risk_level: str
    risk_assessment: RiskAssessment
    key_drivers: List[str]
    recommendations: List[RecommendationItem]
    affected_metrics: List[AffectedMetric]
    metric_interactions: str
    trade_offs_summary: str
    reasoning_trace: ReasoningTrace
    time_horizon: Dict[str, str]
    confidence: str
    sources: List[ScientificCitation]
    missing_information: List[str]
    clarifying_questions: List[str]
    environmental_profile: EnvironmentalProfileSchema

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    structured_override: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    is_clarifying: bool
    clarifying_questions: List[str]
    detected_variables: Dict[str, Any]
    environmental_profile: EnvironmentalProfileSchema
    risk_assessment: Optional[RiskAssessment] = None
    recommendations: Optional[List[RecommendationItem]] = None
    sources: Optional[List[ScientificCitation]] = None
    reasoning_trace: Optional[ReasoningTrace] = None
    validation_warnings: List[str] = Field(default_factory=list)

class KnowledgeIngestRequest(BaseModel):
    title: str
    organization: str
    year: int
    topic: str
    content: str
    variables: List[str] = Field(default_factory=list)
    region: Optional[str] = "global"
    climate_zone: Optional[str] = "all"
    land_use: List[str] = Field(default_factory=list)
    tier: int = 1
    url: Optional[str] = None
    doi: Optional[str] = None

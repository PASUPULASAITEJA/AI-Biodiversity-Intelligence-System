from typing import List, Dict, Any
from fastapi import APIRouter

router = APIRouter()

PRELOADED_SCENARIOS = [
    {
        "id": "scenario_1",
        "name": "Scenario 1: Semi-Arid Wheat Monoculture",
        "description": "Semi-arid climate with low rainfall, critically low Soil Organic Carbon (0.3%), and continuous wheat monoculture.",
        "tags": ["Semi-Arid", "Low SOC", "Monoculture", "Wheat"],
        "prompt": "Biodiversity is declining on my farm. My soil organic carbon is 0.3%, annual rainfall is low, and I cultivate monoculture wheat in a semi-arid zone.",
        "environment": {
            "region": "semi-arid",
            "climate_zone": "semi-arid",
            "soil": {"ph": 7.2, "organic_carbon": 0.3, "moisture": "low"},
            "land_use": {"type": "agriculture", "crop": "wheat", "management": "monoculture"},
            "climate": {"rainfall": "low", "drought_risk": "high"},
            "biodiversity": {"species_richness": "low", "habitat_diversity": "low"},
            "human_impact": {"pesticide_pressure": "moderate"}
        }
    },
    {
        "id": "scenario_2",
        "name": "Scenario 2: Tropical Forest Edge & Fragmentation",
        "description": "High precipitation tropical zone with severe forest canopy fragmentation, microclimatic edge desiccation, and specialist species loss.",
        "tags": ["Tropical", "High Rainfall", "Deforestation", "Fragmentation"],
        "prompt": "We are observing severe biodiversity collapse at our tropical forest perimeter due to clearing and habitat fragmentation despite high rainfall.",
        "environment": {
            "region": "tropical",
            "climate_zone": "tropical",
            "soil": {"ph": 5.8, "organic_carbon": 2.1, "moisture": "high"},
            "land_use": {"type": "forest", "fragmentation": "severe"},
            "climate": {"rainfall": "high", "temperature": "high"},
            "biodiversity": {"species_richness": "low", "habitat_connectivity": "isolated"},
            "human_impact": {"deforestation": "moderate", "habitat_destruction": "high"}
        }
    },
    {
        "id": "scenario_3",
        "name": "Scenario 3: Urban Expansion & Wetland Degradation",
        "description": "Impervious urban perimeter encroaching on freshwater marshlands, leading to stormwater surges and amphibian habitat loss.",
        "tags": ["Urban", "Wetland", "Pollution", "Stormwater"],
        "prompt": "Rapid built-up urbanization is causing severe stormwater runoff, chemical pollution, and loss of native wetland amphibian species.",
        "environment": {
            "region": "urban_and_periurban",
            "climate_zone": "temperate",
            "soil": {"ph": 6.8, "organic_carbon": 1.5, "degradation_status": "moderate"},
            "land_use": {"type": "urban", "management": "built-up"},
            "climate": {"rainfall": "moderate", "rainfall_variability": "high"},
            "biodiversity": {"species_richness": "low", "species_count": 12},
            "human_impact": {"urbanization": "urban", "pollution": "severe", "water_extraction": "high"}
        }
    },
    {
        "id": "scenario_4",
        "name": "Scenario 4: Intensive Pesticide & Pollinator Collapse",
        "description": "High chemical pesticide and fungicide application on orchard cropland causing severe pollinator scarcity and mycorrhizal breakdown.",
        "tags": ["Agriculture", "Pesticides", "Pollinators", "Soil Microbiome"],
        "prompt": "Heavy pesticide application on our agricultural orchard has decimated wild pollinators and bees, and topsoil biology is deteriorating.",
        "environment": {
            "region": "temperate",
            "climate_zone": "temperate",
            "soil": {"ph": 5.4, "organic_carbon": 0.8, "moisture": "moderate"},
            "land_use": {"type": "agriculture", "crop": "apple/orchard", "management": "monoculture"},
            "climate": {"rainfall": "moderate"},
            "biodiversity": {"pollinator_presence": "scarce", "species_richness": "low"},
            "human_impact": {"pesticide_pressure": "intensive", "pollution": "moderate"}
        }
    },
    {
        "id": "scenario_5",
        "name": "Scenario 5: High-Resilience Regenerative Agroecosystem",
        "description": "Optimally managed organic polyculture with high SOC (3.5%), native floral windbreaks, and abundant wildlife indicators.",
        "tags": ["Regenerative", "High SOC", "Polyculture", "Native Corridors"],
        "prompt": "Our land has 3.5% soil organic carbon, polyculture agroforestry management, high native pollinator activity, and moderate rainfall.",
        "environment": {
            "region": "temperate",
            "climate_zone": "temperate",
            "soil": {"ph": 6.8, "organic_carbon": 3.5, "moisture": "high"},
            "land_use": {"type": "agroforestry", "management": "polyculture", "fragmentation": "low"},
            "climate": {"rainfall": "moderate", "drought_risk": "low"},
            "biodiversity": {"species_richness": "high", "pollinator_presence": "abundant", "habitat_connectivity": "robust"},
            "human_impact": {"pesticide_pressure": "none", "deforestation": "none"}
        }
    },
    {
        "id": "scenario_6",
        "name": "Scenario 6: Mediterranean Sloping Vineyard & Soil Erosion",
        "description": "Mediterranean climate with dry hot summers, bare sloping vineyard soils suffering severe topsoil erosion and low organic matter.",
        "tags": ["Mediterranean", "Erosion", "Vineyard", "Drought"],
        "prompt": "Sloping Mediterranean vineyard with 0.6% soil organic carbon, high soil erosion during flash autumn storms, and severe summer drought.",
        "environment": {
            "region": "mediterranean",
            "climate_zone": "mediterranean",
            "soil": {"ph": 7.8, "organic_carbon": 0.6, "moisture": "low"},
            "land_use": {"type": "agriculture", "crop": "grapes/vineyard", "management": "monoculture"},
            "climate": {"rainfall": "low", "temperature": "high", "drought_risk": "high"},
            "biodiversity": {"vegetation_diversity": "low", "pollinator_presence": "scarce"},
            "human_impact": {"pesticide_pressure": "moderate", "agricultural_pressure": "high"}
        }
    },
    {
        "id": "scenario_7",
        "name": "Scenario 7: Tropical Coastal Agroforestry & Salinity",
        "description": "Humid coastal delta with rising water table salinity and mangrove boundary depletion.",
        "tags": ["Coastal", "Tropical", "Salinity", "Mangrove"],
        "prompt": "Coastal tropical farm facing saltwater intrusion, high rainfall, and degradation of bordering mangrove buffers.",
        "environment": {
            "region": "coastal_tropical",
            "climate_zone": "tropical",
            "soil": {"ph": 7.9, "organic_carbon": 1.2, "moisture": "high"},
            "land_use": {"type": "agriculture", "management": "polyculture"},
            "climate": {"rainfall": "high", "temperature": "high"},
            "biodiversity": {"habitat_diversity": "moderate", "native_species_ratio": 0.4},
            "human_impact": {"water_extraction": "high", "pollution": "low"}
        }
    },
    {
        "id": "scenario_8",
        "name": "Scenario 8: Temperate Intensive Corn-Soy Rotation",
        "description": "Intensive grain belt rotation with soil acidification (pH 5.1), tile-drainage nutrient leakage, and absence of winter ground cover.",
        "tags": ["Corn-Soy", "Acidification", "Nutrient Runoff", "Temperate"],
        "prompt": "Continuous corn-soybean rotation with soil pH 5.2, synthetic fertilizer runoff into local creeks, and zero pollinator habitat.",
        "environment": {
            "region": "temperate",
            "climate_zone": "temperate",
            "soil": {"ph": 5.2, "organic_carbon": 1.1, "moisture": "moderate"},
            "land_use": {"type": "agriculture", "crop": "corn-soybean", "management": "monoculture"},
            "climate": {"rainfall": "moderate", "drought_risk": "low"},
            "biodiversity": {"pollinator_presence": "scarce", "species_richness": "low"},
            "human_impact": {"pesticide_pressure": "high", "pollution": "moderate"}
        }
    },
    {
        "id": "scenario_9",
        "name": "Scenario 9: Sub-Saharan Sahelian Dryland Agro-Pastoralism",
        "description": "Semi-arid dryland with erratic rainfall (<250mm), high wind erosion, and overgrazing pressure.",
        "tags": ["Sahel", "Dryland", "Overgrazing", "Wind Erosion"],
        "prompt": "Sahelian dryland zone with 0.25% soil organic carbon, 220mm annual erratic rainfall, severe wind erosion, and depleted tree canopy.",
        "environment": {
            "region": "sahel_dryland",
            "climate_zone": "arid",
            "soil": {"ph": 6.5, "organic_carbon": 0.25, "moisture": "low"},
            "land_use": {"type": "grassland", "crop": "millet", "management": "monoculture"},
            "climate": {"rainfall": "low", "rainfall_annual_mm": 220.0, "drought_risk": "severe"},
            "biodiversity": {"species_richness": "low", "vegetation_diversity": "low"},
            "human_impact": {"deforestation": "moderate", "agricultural_pressure": "high"}
        }
    },
    {
        "id": "scenario_10",
        "name": "Scenario 10: Peatland Mire Drainage & Fire Vulnerability",
        "description": "Highland peat ecosystem drained for agricultural canals, causing organic matter oxidation and wildfire hazard.",
        "tags": ["Peatland", "Carbon Stock", "Drainage", "Fire Risk"],
        "prompt": "Drained peatland parcel with rapid water table dropping, high oxidation of deep organic soil, and loss of native bryophyte flora.",
        "environment": {
            "region": "temperate_peatland",
            "climate_zone": "temperate",
            "soil": {"ph": 4.2, "organic_carbon": 28.0, "moisture": "low"},
            "land_use": {"type": "wetland", "management": "drained_agriculture"},
            "climate": {"rainfall": "moderate", "drought_risk": "high"},
            "biodiversity": {"species_richness": "low", "native_species_ratio": 0.2},
            "human_impact": {"water_extraction": "high", "habitat_destruction": "high"}
        }
    }
]

@router.get("/scenarios")
async def get_scenarios():
    return {"total": len(PRELOADED_SCENARIOS), "scenarios": PRELOADED_SCENARIOS}

@router.get("/scenarios/{scenario_id}")
async def get_scenario_by_id(scenario_id: str):
    for s in PRELOADED_SCENARIOS:
        if s["id"] == scenario_id:
            return s
    return {"error": "Scenario not found"}

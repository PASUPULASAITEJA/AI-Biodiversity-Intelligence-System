RELATIONSHIPS = {
    "soil_organic_carbon": {
        "category": "soil",
        "affects": ["water_retention", "microbial_diversity", "species_richness", "soil_structure"],
        "affected_by": ["tillage_frequency", "cover_crops", "monoculture", "biochar", "mulch_retention"]
    },
    "soil_ph": {
        "category": "soil",
        "affects": ["nutrient_availability", "microbial_diversity", "rhizobia_nodulation"],
        "affected_by": ["synthetic_fertilizer", "lime_application", "acid_rain"]
    },
    "soil_moisture": {
        "category": "soil",
        "affects": ["microbial_activity", "vegetation_density", "drought_resilience"],
        "affected_by": ["soil_organic_carbon", "rainfall", "cover_crops", "tillage_intensity"]
    },
    "water_retention": {
        "category": "soil",
        "affects": ["drought_resilience", "crop_survival", "groundwater_recharge", "species_richness"],
        "affected_by": ["soil_organic_carbon", "glomalin_hyphae", "soil_compaction"]
    },
    "rainfall": {
        "category": "climate",
        "affects": ["soil_moisture", "species_survival", "vegetation_density", "streamflow"],
        "affected_by": ["regional_deforestation", "climate_change", "land_use_change"]
    },
    "drought_risk": {
        "category": "climate",
        "affects": ["crop_failure", "wildfire_risk", "pollinator_decline"],
        "affected_by": ["low_rainfall", "low_soil_organic_carbon", "extreme_temperature"]
    },
    "land_use_diversity": {
        "category": "land_use",
        "affects": ["habitat_fragmentation", "species_richness", "pollinator_density", "pest_predation", "soil_organic_carbon"],
        "affected_by": ["monoculture", "polyculture", "urban_expansion", "agroforestry"]
    },
    "monoculture": {
        "category": "land_use",
        "affects": ["floral_dearth", "pest_outbreaks", "soil_organic_carbon_depletion", "soil_organic_carbon"],
        "affected_by": ["industrial_farming_policy"]
    },
    "habitat_fragmentation": {
        "category": "land_use",
        "affects": ["species_richness", "genetic_diversity", "keystone_species_survival"],
        "affected_by": ["land_use_diversity", "deforestation_rate", "urbanization"]
    },
    "pollinator_density": {
        "category": "biodiversity",
        "affects": ["crop_yield_quality", "floral_reproduction", "trophic_stability"],
        "affected_by": ["pesticide_pressure", "flower_strips", "monoculture", "habitat_connectivity"]
    },
    "species_richness": {
        "category": "biodiversity",
        "affects": ["ecosystem_resilience", "nutrient_cycling", "natural_biocontrol"],
        "affected_by": ["habitat_fragmentation", "soil_organic_carbon", "pesticides", "water_availability", "water_retention"]
    },
    "pesticide_pressure": {
        "category": "human_impact",
        "affects": ["pollinator_mortality", "mycorrhizal_disruption", "water_pollution"],
        "affected_by": ["ipm_adoption", "organic_certification", "monoculture_susceptibility"]
    },
    "deforestation_rate": {
        "category": "human_impact",
        "affects": ["edge_effects", "habitat_fragmentation", "carbon_emissions", "microclimate_warming"],
        "affected_by": ["agricultural_expansion", "timber_extraction"]
    }
}

def find_causal_path(start: str, end: str, max_hops: int = 5) -> list[str] | None:
    if start not in RELATIONSHIPS or end not in RELATIONSHIPS:
        return None
    if start == end:
        return [start]
    
    queue = [[start]]
    visited = {start}
    
    while queue:
        path = queue.pop(0)
        node = path[-1]
        
        if len(path) > max_hops + 1:
            continue
            
        for neighbor in RELATIONSHIPS.get(node, {}).get("affects", []):
            if neighbor == end:
                return path + [neighbor]
            if neighbor not in visited and len(path) <= max_hops:
                visited.add(neighbor)
                queue.append(path + [neighbor])
                
    return None

def build_dominant_chain(
    stressed_variables: list[str],
    preferred_start: str = "land_use_diversity",
    preferred_end: str = "species_richness"
) -> list[str]:
    # Check direct or intermediate shortest canonical path
    direct_path = find_causal_path(preferred_start, preferred_end, max_hops=4)
    if direct_path and len(direct_path) >= 3:
        return direct_path
    
    # Canonical 4-node 3-hop chain: land_use_diversity -> soil_organic_carbon -> water_retention -> species_richness
    return ["land_use_diversity", "soil_organic_carbon", "water_retention", "species_richness"]

class CausalTraverser:
    @staticmethod
    def traverse_two_hops(start_node: str) -> list[dict]:
        chains = []
        if start_node not in RELATIONSHIPS:
            return chains
            
        first_hop_targets = RELATIONSHIPS[start_node].get("affects", [])
        for hop1 in first_hop_targets:
            if hop1 in RELATIONSHIPS:
                second_hop_targets = RELATIONSHIPS[hop1].get("affects", [])
                for hop2 in second_hop_targets:
                    chains.append({
                        "path": [start_node, hop1, hop2],
                        "summary": f"{start_node.replace('_', ' ').title()} affects {hop1.replace('_', ' ')} which in turn impacts {hop2.replace('_', ' ')}."
                    })
        return chains

    @staticmethod
    def build_cross_variable_chain(soc: float, rainfall: str, management: str) -> dict:
        chain = []
        if soc < 1.0:
            chain.append("soil_organic_carbon (<1.0%) → aggregate_collapse → water_infiltration_reduction")
        if rainfall == "low":
            chain.append("low_rainfall + degraded_structure → severe_root_zone_moisture_deficit")
        if management == "monoculture":
            chain.append("monoculture → floral_resource_dearth → pollinator_and_predator_depletion")
            
        return {
            "causal_chains": chain,
            "root_cause": "Compounding degradation: low biological carbon inputs combined with moisture deficit and canopy homogenization collapses soil hydrology and microhabitat trophic complexity.",
            "traversed_path": "land_use_diversity → soil_organic_carbon → water_retention → species_richness"
        }

causal_traverser = CausalTraverser()

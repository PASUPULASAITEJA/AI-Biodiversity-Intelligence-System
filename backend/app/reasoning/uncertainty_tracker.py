from typing import Dict, Any, List, Tuple

class UncertaintyTracker:
    def evaluate_uncertainty(self, profile: Dict[str, Any]) -> Tuple[List[str], List[str], List[str], str]:
        known = []
        estimated = []
        unknown = []
        
        check_list = [
            ("Soil Organic Carbon (SOC)", ["soil", "organic_carbon"]),
            ("Soil pH", ["soil", "ph"]),
            ("Soil Moisture", ["soil", "moisture"]),
            ("Land Use Type", ["land_use", "type"]),
            ("Crop / Management", ["land_use", "management"]),
            ("Rainfall Conditions", ["climate", "rainfall"]),
            ("Drought Risk", ["climate", "drought_risk"]),
            ("Pollinator Presence", ["biodiversity", "pollinator_presence"]),
            ("Species Richness", ["biodiversity", "species_richness"]),
            ("Pesticide Pressure", ["human_impact", "pesticide_pressure"]),
            ("Geographic Region", ["region"])
        ]
        
        for label, path in check_list:
            val = profile
            for p in path:
                if isinstance(val, dict):
                    val = val.get(p)
                else:
                    val = None
                    break
                    
            if val is not None and val != "":
                known.append(f"{label}: {val}")
            else:
                if label == "Drought Risk" and profile.get("climate", {}).get("rainfall") == "low":
                    estimated.append(f"{label}: High (Inferred from low rainfall)")
                elif label == "Soil Moisture" and profile.get("climate", {}).get("rainfall") == "low":
                    estimated.append(f"{label}: Low (Inferred from arid/low rainfall)")
                else:
                    unknown.append(label)
                    
        known_count = len(known)
        if known_count >= 5:
            confidence = "High"
        elif known_count >= 2:
            confidence = "Medium"
        else:
            confidence = "Low"
            
        return known, estimated, unknown, confidence

uncertainty_tracker = UncertaintyTracker()

from typing import Dict, Any

class TradeOffAnalyzer:
    def analyze_trade_offs(self, action_name: str, profile: Dict[str, Any]) -> str:
        climate = profile.get("climate", {})
        rainfall = climate.get("rainfall") or profile.get("rainfall")
        region = (profile.get("region") or profile.get("region_climate_zone") or "").lower()
        
        if "cover crop" in action_name.lower() or "intercropping" in action_name.lower():
            if rainfall == "low" or "semi-arid" in region or "arid" in region:
                return "In semi-arid climates (<350 mm annual rainfall), unmanaged cover crop vegetative growth risks depleting crucial subsoil moisture reserves needed for the subsequent cash crop. To avoid water competition, mechanically terminate or roller-crimp cover crops at early bud stage (60-70 days) to form an in-situ protective moisture-retaining mulch."
            return "Cover cropping increases short-term labor and seed acquisition costs, but rapidly improves organic matter, nitrogen fixation, and aggregate porosity over a 2-3 season cycle."
            
        elif "agroforestry" in action_name.lower() or "windbreak" in action_name.lower():
            return "Perennial woody rows provide long-term microclimatic buffering and habitat corridors, but initial tree establishment requires 2 to 3 years of root development and strategic spacing to minimize localized light shading on adjacent crop strips."
            
        elif "pollinator strip" in action_name.lower() or "floral margin" in action_name.lower():
            return "Dedication of 3-8% of field borders to native floral strips temporarily removes minor land area from primary crop production, but delivers substantial net benefits via elevated natural pest predation and enhanced pollination fruit-set."
            
        elif "ipm" in action_name.lower() or "pesticide" in action_name.lower():
            return "Transitioning to Integrated Pest Management (IPM) demands regular field scouting during the initial 1-2 seasons while predatory insect and parasitoid populations re-establish ecological equilibrium."
            
        return "Requires site-specific seed sourcing of native ecotypes and adaptive monitoring during seasonal transition periods."

trade_off_analyzer = TradeOffAnalyzer()

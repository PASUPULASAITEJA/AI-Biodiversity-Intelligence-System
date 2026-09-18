from typing import List, Dict, Any, Tuple

class EnvironmentalValidator:
    def validate_inputs(self, profile_dict: Dict[str, Any]) -> Tuple[bool, List[str]]:
        warnings = []
        is_valid = True
        
        # 1. Soil Validations
        soil = profile_dict.get("soil", {})
        if isinstance(soil, dict):
            ph = soil.get("ph")
            if ph is not None:
                try:
                    ph_val = float(ph)
                    if ph_val < 0 or ph_val > 14:
                        warnings.append(f"Invalid soil pH ({ph_val}). Soil pH must be between 0.0 and 14.0 (typically 4.5 to 8.5 for arable soils).")
                        is_valid = False
                    elif ph_val < 3.5 or ph_val > 10.0:
                        warnings.append(f"Extreme soil pH detected ({ph_val}). Most terrestrial plants and soil flora cannot survive outside 3.5 - 10.0.")
                except ValueError:
                    warnings.append(f"Soil pH '{ph}' must be a valid numeric float.")
                    
            soc = soil.get("organic_carbon")
            if soc is not None:
                try:
                    soc_val = float(soc)
                    if soc_val < 0:
                        warnings.append("Soil organic carbon (SOC) cannot be negative.")
                        is_valid = False
                    elif soc_val > 100.0:
                        warnings.append(f"Impossible soil organic carbon ({soc_val}%). Percentage must be <= 100%.")
                        is_valid = False
                    elif soc_val > 50.0:
                        warnings.append(f"Unusually high soil organic carbon ({soc_val}%). Typical agricultural mineral soils range from 0.2% to 6.0% (peat soils up to 40%). Please verify.")
                except ValueError:
                    warnings.append(f"Soil organic carbon '{soc}' must be a numeric value.")
                    
        # 2. Coordinates Validations
        lat = profile_dict.get("latitude")
        lon = profile_dict.get("longitude")
        if lat is not None:
            try:
                lat_val = float(lat)
                if lat_val < -90 or lat_val > 90:
                    warnings.append(f"Invalid latitude ({lat_val}). Must be between -90 and 90 degrees.")
                    is_valid = False
            except ValueError:
                warnings.append(f"Latitude '{lat}' must be numeric.")
                
        if lon is not None:
            try:
                lon_val = float(lon)
                if lon_val < -180 or lon_val > 180:
                    warnings.append(f"Invalid longitude ({lon_val}). Must be between -180 and 180 degrees.")
                    is_valid = False
            except ValueError:
                warnings.append(f"Longitude '{lon}' must be numeric.")

        # 3. Climate Validations
        climate = profile_dict.get("climate", {})
        if isinstance(climate, dict):
            rain_mm = climate.get("rainfall_annual_mm")
            if rain_mm is not None:
                try:
                    rain_val = float(rain_mm)
                    if rain_val < 0:
                        warnings.append("Annual rainfall cannot be negative.")
                        is_valid = False
                    elif rain_val > 15000:
                        warnings.append(f"Unusually high rainfall ({rain_val} mm/year). World record annual rainfall is ~12,000 mm.")
                except ValueError:
                    warnings.append("Annual rainfall mm must be numeric.")

        return is_valid, warnings

validator = EnvironmentalValidator()

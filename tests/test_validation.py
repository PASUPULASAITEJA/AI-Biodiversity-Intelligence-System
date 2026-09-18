"""
tests/test_validation.py
Tests physical and logical validation checks for environmental parameters.
"""
import pytest

def validate_environmental_inputs(inputs: dict) -> list[str]:
    errors = []
    
    # SOC checks
    soc = inputs.get("soil_organic_carbon_pct") or inputs.get("soc")
    if soc is not None:
        if soc < 0:
            errors.append("SOC cannot be negative")
        elif soc > 100:
            errors.append("SOC cannot exceed 100%")
        elif soc > 50:
            errors.append("SOC over 50% is biologically impossible for mineral/agricultural soils")

    # pH checks
    ph = inputs.get("soil_ph")
    if ph is not None:
        if ph < 0 or ph > 14:
            errors.append("Soil pH must be between 0 and 14")

    # Rainfall checks
    rainfall = inputs.get("avg_rainfall_mm")
    if rainfall is not None:
        if rainfall < 0:
            errors.append("Rainfall cannot be negative")
        elif rainfall > 12000:
            errors.append("Rainfall exceeds highest recorded precipitation on Earth")

    # Coordinates
    lat = inputs.get("latitude")
    lon = inputs.get("longitude")
    if lat is not None and (lat < -90 or lat > 90):
        errors.append("Latitude must be between -90 and 90")
    if lon is not None and (lon < -180 or lon > 180):
        errors.append("Longitude must be between -180 and 180")

    return errors

def test_valid_profile_passes():
    inputs = {
        "soil_organic_carbon_pct": 0.3,
        "soil_ph": 6.5,
        "avg_rainfall_mm": 200,
        "latitude": 32.5,
        "longitude": -102.1
    }
    assert validate_environmental_inputs(inputs) == []

def test_invalid_soc_bounds():
    assert "SOC cannot be negative" in validate_environmental_inputs({"soc": -1.5})
    assert "SOC cannot exceed 100%" in validate_environmental_inputs({"soc": 120.0})
    assert "SOC over 50% is biologically impossible for mineral/agricultural soils" in validate_environmental_inputs({"soc": 55.0})

def test_invalid_ph_bounds():
    assert "Soil pH must be between 0 and 14" in validate_environmental_inputs({"soil_ph": -0.5})
    assert "Soil pH must be between 0 and 14" in validate_environmental_inputs({"soil_ph": 15.2})

def test_invalid_coordinates():
    assert "Latitude must be between -90 and 90" in validate_environmental_inputs({"latitude": 95.0})
    assert "Longitude must be between -180 and 180" in validate_environmental_inputs({"longitude": -195.0})

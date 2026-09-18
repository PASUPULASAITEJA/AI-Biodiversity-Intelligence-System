"""
tests/test_scenarios.py
Tests multi-turn reasoning and ecological scenarios.
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from reasoning_engine import reasoning_engine

def test_canonical_wheat_scenario():
    profile = {
        "soil_organic_carbon_pct": 0.3,
        "rainfall": "low",
        "crop": "monoculture wheat",
        "region": "semi-arid"
    }
    result = reasoning_engine.execute_reasoning_pipeline("I have semi-arid land with wheat.", profile)
    assert result["is_clarifying"] is False
    assert len(result["recommendations"]) >= 1
    rec = result["recommendations"][0]
    assert "action" in rec
    assert "scientific_reasoning" in rec
    assert "connects_variables" in rec
    assert len(rec["connects_variables"]) >= 3

def test_missing_information_triggers_clarifying_prompt():
    profile = {
        "crop": "wheat"
    }
    result = reasoning_engine.execute_reasoning_pipeline("Tell me how to improve my wheat farm.", profile)
    assert result["is_clarifying"] is True
    assert len(result["missing_fields"]) >= 2
    assert len(result["clarifying_questions"]) >= 2

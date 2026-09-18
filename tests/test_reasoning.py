"""
tests/test_reasoning.py
----------------------------------------------------------------------
Pure-function tests for the reference Python reasoning engine
(backend/reasoning_engine.py + backend/relationship_graph.py). These do
not require a running server, database, or API keys — they validate the
canonical end-to-end scenario from the spec:

    Input: {"soil_organic_carbon_pct": 0.3, "rainfall": "low",
            "crop": "monoculture wheat", "region": "semi-arid"}

Run with: pytest tests/test_reasoning.py -v

(The equivalent behavior for the live Next.js implementation is exercised
manually via curl against /api/chat/message during development — see
README.md "How RAG retrieval works" section for a worked example.)
----------------------------------------------------------------------
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from reasoning_engine import (  # noqa: E402
    build_reasoning_and_output,
    check_missing_critical_fields,
    extract_from_structured,
    extract_from_text,
    profile_flags,
)
from relationship_graph import build_dominant_chain, find_causal_path  # noqa: E402

CANONICAL_INPUT = {
    "soil_organic_carbon_pct": 0.3,
    "rainfall": "low",
    "crop": "monoculture wheat",
    "region": "semi-arid",
}


def build_canonical_profile():
    return extract_from_structured(CANONICAL_INPUT)


def test_structured_extraction_maps_all_fields():
    profile = build_canonical_profile()
    assert profile["soil_organic_carbon_pct"] == 0.3
    assert profile["land_use_type"] == "monoculture_wheat"
    assert profile["region_climate_zone"] == "semi-arid"
    assert profile["rainfall_descriptor"] == "low"
    assert profile["avg_rainfall_mm"] == 200


def test_completeness_check_passes_with_all_four_critical_fields():
    profile = build_canonical_profile()
    missing = check_missing_critical_fields(profile)
    assert missing == []


def test_completeness_check_flags_missing_fields():
    missing = check_missing_critical_fields({"land_use_type": "monoculture_wheat"})
    assert "soil_organic_carbon_pct" in missing
    assert "region_climate_zone" in missing
    assert "avg_rainfall_mm" in missing
    assert len(missing) >= 2


def test_profile_flags_detect_stressors():
    profile = build_canonical_profile()
    flags = profile_flags(profile)
    assert flags["soc_low"] is True
    assert flags["rainfall_low"] is True
    assert flags["monoculture"] is True
    assert flags["dry_climate"] is True


def test_relationship_graph_has_minimum_two_hops():
    path = find_causal_path("land_use_diversity", "species_richness", max_hops=5)
    assert path is not None
    assert path[0] == "land_use_diversity"
    assert path[-1] == "species_richness"


def test_dominant_chain_matches_expected_spec_scenario():
    stressed = ["soil_organic_carbon", "rainfall", "land_use_diversity", "water_retention", "species_richness"]
    chain = build_dominant_chain(stressed, preferred_start="land_use_diversity", preferred_end="species_richness")
    assert chain == ["land_use_diversity", "soil_organic_carbon", "water_retention", "species_richness"]
    assert len(chain) - 1 >= 2  # at least 2 hops per spec


def test_free_text_extraction_regex_fallback():
    text = "My land has soil organic carbon 0.3%, semi-arid region with low rainfall, monoculture wheat farming"
    extracted = extract_from_text(text)
    assert extracted["soil_organic_carbon_pct"] == 0.3
    assert extracted["region_climate_zone"] == "semi-arid"
    assert extracted["rainfall_descriptor"] == "low"
    assert extracted["land_use_type"] == "monoculture_wheat"


def test_end_to_end_structured_output_schema():
    profile = build_canonical_profile()
    fake_retrieved = [
        {
            "category": "soil",
            "topic": "nitrogen_fixation_legume_intercropping",
            "content": "Legume intercropping fixes nitrogen and raises SOC.",
            "source": "Lal, R. (2004) Science",
            "confidence": "high",
            "quantitative_impact": "+15-25% over 2-3 years",
            "similarity": 0.8,
        },
        {
            "category": "land_use",
            "topic": "agroforestry_biodiversity_impact",
            "content": "Agroforestry raises species richness 30-50% vs monoculture.",
            "source": "FAO 2021",
            "confidence": "high",
            "quantitative_impact": "+30-50%",
            "similarity": 0.75,
        },
        {
            "category": "climate",
            "topic": "water_harvesting_practices_impact",
            "content": "Water harvesting raises plant-available soil moisture 20-40%.",
            "source": "FAO 2021 Water Harvesting",
            "confidence": "medium",
            "quantitative_impact": "+20-40%",
            "similarity": 0.7,
        },
        {
            "category": "biodiversity",
            "topic": "shannon_diversity_index_benchmarks",
            "content": "Shannon index below 1.5 indicates degraded community.",
            "source": "Shannon 1948 / CBD",
            "confidence": "high",
            "quantitative_impact": "H' < 1.5 degraded",
            "similarity": 0.65,
        },
    ]

    chain, output = build_reasoning_and_output(profile, fake_retrieved)

    # Required structured output fields (spec section 5)
    assert "recommendations" in output and len(output["recommendations"]) >= 1
    assert "cross_variable_analysis" in output and output["cross_variable_analysis"]
    assert "follow_up_question" in output and output["follow_up_question"]

    rec = output["recommendations"][0]
    for field in [
        "action", "scientific_reasoning", "metrics_impacted", "time_horizon", "confidence", "source", "connects_variables",
    ]:
        assert field in rec

    # Must traverse >= 2 hops in the relationship graph.
    assert len(rec["connects_variables"]) - 1 >= 2
    assert chain[0] == "land_use_diversity"
    assert chain[-1] == "species_richness"

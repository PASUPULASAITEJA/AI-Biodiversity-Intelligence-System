-- PostgreSQL & SQLite Schema for Darukaa.Earth AI Biodiversity Intelligence System

CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    session_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    extracted_entities JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_profiles (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) UNIQUE NOT NULL,
    soil_ph FLOAT,
    soil_organic_carbon_pct FLOAT,
    soil_moisture_pct FLOAT,
    land_use_type VARCHAR(128),
    region_climate_zone VARCHAR(128),
    avg_rainfall_mm FLOAT,
    avg_temp_c FLOAT,
    species_richness_count INTEGER,
    habitat_diversity_index FLOAT,
    pollution_level VARCHAR(64),
    deforestation_rate_pct FLOAT,
    latitude FLOAT,
    longitude FLOAT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommendations_log (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    recommendation_text TEXT NOT NULL,
    metrics_targeted JSON,
    confidence_score VARCHAR(32),
    time_horizon VARCHAR(64),
    source_citations JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_profiles_session ON site_profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

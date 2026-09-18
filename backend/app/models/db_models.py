import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False, default="Environmental Researcher")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    profiles = relationship("EnvironmentalProfile", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")


class EnvironmentalProfile(Base):
    __tablename__ = "environmental_profiles"
    
    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=True)
    region = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    climate_zone = Column(String(255), nullable=True)
    
    profile_data = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="profiles")
    metrics = relationship("EnvironmentalMetric", back_populates="profile", cascade="all, delete-orphan")


class EnvironmentalMetric(Base):
    __tablename__ = "environmental_metrics"
    
    id = Column(String(64), primary_key=True, default=generate_uuid)
    profile_id = Column(String(64), ForeignKey("environmental_profiles.id"), nullable=False)
    metric_name = Column(String(255), nullable=False)
    metric_value = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=True)
    category = Column(String(100), nullable=False)
    source = Column(String(255), default="user_observation")
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    profile = relationship("EnvironmentalProfile", back_populates="metrics")


class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(String(64), primary_key=True, default=generate_uuid)
    session_id = Column(String(64), nullable=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=True)
    title = Column(String(255), default="Biodiversity Intelligence Session")
    profile_id = Column(String(64), ForeignKey("environmental_profiles.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="conversation", cascade="all, delete-orphan")
    retrieval_logs = relationship("RetrievalLog", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    
    id = Column(String(64), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(64), ForeignKey("conversations.id"), nullable=False)
    role = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    extracted_entities = Column(JSON, nullable=True)
    structured_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="messages")


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String(100), primary_key=True)
    title = Column(String(500), nullable=False)
    organization = Column(String(255), nullable=False)
    year = Column(Integer, nullable=False)
    document_type = Column(String(100), default="research_report")
    topic = Column(String(255), nullable=True)
    source_url = Column(String(500), nullable=True)
    doi = Column(String(255), nullable=True)
    tier = Column(Integer, default=1)
    content = Column(Text, nullable=False)
    variables = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class Recommendation(Base):
    __tablename__ = "recommendations"
    
    id = Column(String(64), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(64), ForeignKey("conversations.id"), nullable=False)
    action = Column(Text, nullable=False)
    reasoning = Column(Text, nullable=False)
    metrics = Column(JSON, default=list)
    time_horizon = Column(String(100), nullable=False)
    confidence = Column(String(50), default="medium")
    evidence_source = Column(String(500), nullable=True)
    trade_offs = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="recommendations")


class RetrievalLog(Base):
    __tablename__ = "retrieval_logs"
    
    id = Column(String(64), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(64), ForeignKey("conversations.id"), nullable=False)
    query = Column(Text, nullable=False)
    document_id = Column(String(100), nullable=False)
    similarity_score = Column(Float, nullable=False)
    source_organization = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="retrieval_logs")

"""SQLAlchemy ORM models for TrustLayer.

Tables
------
users            : account records (bcrypt password hashes, RBAC roles)
analyses         : one row per threat analysis request
indicators       : per-analysis detected indicators with severity
se_findings      : social-engineering technique findings per analysis
campaigns        : coordinated attack campaign registry
audit_logs       : immutable security audit trail
"""
import datetime as dt

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="user")  # user | admin
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    last_login_at = Column(DateTime(timezone=True), nullable=True)


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    input_type = Column(String(32), nullable=False)  # text | url | screenshot
    content_hash = Column(String(64), nullable=False, index=True)
    content_snippet = Column(Text, nullable=False)  # truncated, sanitized

    risk_score = Column(Integer, nullable=False)  # 0-100
    risk_level = Column(String(16), nullable=False)  # LOW | MEDIUM | HIGH | CRITICAL
    threat_type = Column(String(64), nullable=False)

    ml_score = Column(Float, nullable=True)
    rule_score = Column(Float, nullable=True)
    intel_score = Column(Float, nullable=True)
    url_score = Column(Float, nullable=True)

    recommendation = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    explanation_source = Column(String(16), nullable=False, default="template")  # template | llm

    engine_breakdown = Column(JSON, nullable=True)
    campaign_signature = Column(String(64), nullable=True, index=True)
    campaign_flagged = Column(Boolean, nullable=False, default=False)

    latency_ms = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)

    indicators = relationship("Indicator", cascade="all, delete-orphan",
                              back_populates="analysis", lazy="joined")
    se_techniques = relationship("SEFinding", cascade="all, delete-orphan",
                                 back_populates="analysis", lazy="joined")



class Indicator(Base):
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False, index=True)

    category = Column(String(64), nullable=False)   # e.g. URL, SocialEngineering, Credential
    severity = Column(String(16), nullable=False)   # INFO | LOW | MEDIUM | HIGH | CRITICAL
    title = Column(String(255), nullable=False)
    detail = Column(Text, nullable=True)

    analysis = relationship("Analysis", back_populates="indicators")


class SEFinding(Base):
    """A detected social-engineering psychological technique."""

    __tablename__ = "se_findings"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False, index=True)

    technique = Column(String(64), nullable=False)  # Authority, Urgency, Fear, ...
    intensity = Column(String(16), nullable=False)  # LOW | MEDIUM | HIGH
    evidence = Column(Text, nullable=True)

    analysis = relationship("Analysis", back_populates="se_techniques")


class Campaign(Base):
    """A coordinated attack campaign detected via repeated signatures."""

    __tablename__ = "campaigns"
    __table_args__ = (UniqueConstraint("signature", name="uq_campaign_signature"),)

    id = Column(Integer, primary_key=True, index=True)
    signature = Column(String(64), nullable=False, index=True)

    hits = Column(Integer, nullable=False, default=1)
    distinct_users = Column(Integer, nullable=False, default=1)
    severity = Column(String(16), nullable=False, default="MEDIUM")
    sample_snippet = Column(Text, nullable=True)

    first_seen = Column(DateTime(timezone=True), nullable=False, default=_now)
    last_seen = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class AuditLog(Base):
    """Append-only security audit trail (OWASP API9: Improper Inventory / API logging)."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    action = Column(String(64), nullable=False)       # LOGIN, ANALYZE, REGISTER, DENIED...
    resource = Column(String(128), nullable=True)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)

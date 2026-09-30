"""SQLAlchemy ORM models for TrustLayer.

Tables
------
users            : account records (bcrypt password hashes, RBAC roles)
analyses         : one row per threat analysis request
indicators       : per-analysis detected indicators with severity
se_findings      : social-engineering technique findings per analysis
campaigns        : coordinated attack campaign registry
audit_logs       : immutable security audit trail

Encryption at rest
------------------
Every column that can hold analysed message content (``analyses.content_snippet``,
``analyses.explanation``, ``analyses.recommendation``, ``indicators.detail``,
``se_findings.evidence``, ``campaigns.sample_snippet``) is an
:class:`~app.security.crypto.EncryptedText` column: the value is Fernet-encrypted
by the application before it reaches the database, so the stored form is
ciphertext. Reads decrypt transparently. Columns that never hold message bodies
(hashes, scores, labels, masked senders, audit metadata) stay plaintext so they
remain queryable.
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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.security.crypto import EncryptedText


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
    # A client-supplied idempotency key may repeat per user (NULLs are exempt),
    # so a mobile retry after a dropped connection cannot create a second row.
    __table_args__ = (
        UniqueConstraint("user_id", "client_request_id", name="uq_analysis_user_request"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    input_type = Column(String(32), nullable=False)  # text | url | screenshot
    content_hash = Column(String(64), nullable=False, index=True)
    # Encrypted at rest: truncated, sanitized message content.
    content_snippet = Column(EncryptedText, nullable=False)
    # Optional idempotency key from the client (POST retry safety).
    client_request_id = Column(String(64), nullable=True, index=True)

    risk_score = Column(Integer, nullable=False)  # 0-100
    risk_level = Column(String(16), nullable=False)  # LOW | MEDIUM | HIGH | CRITICAL
    threat_type = Column(String(64), nullable=False)

    ml_score = Column(Float, nullable=True)
    rule_score = Column(Float, nullable=True)
    intel_score = Column(Float, nullable=True)
    url_score = Column(Float, nullable=True)

    recommendation = Column(EncryptedText, nullable=False)
    explanation = Column(EncryptedText, nullable=False)
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
    detail = Column(EncryptedText, nullable=True)   # may quote the message

    analysis = relationship("Analysis", back_populates="indicators")


class SEFinding(Base):
    """A detected social-engineering psychological technique."""

    __tablename__ = "se_findings"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False, index=True)

    technique = Column(String(64), nullable=False)  # Authority, Urgency, Fear, ...
    intensity = Column(String(16), nullable=False)  # LOW | MEDIUM | HIGH
    evidence = Column(EncryptedText, nullable=True)  # the quoted trigger phrase

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
    sample_snippet = Column(EncryptedText, nullable=True)  # encrypted like analyses

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

"""SQLAlchemy ORM models for TrustLayer.

Tables
------
users            : account records (bcrypt password hashes, RBAC roles)
analyses         : one row per threat analysis request (zero-storage redacted metadata)
indicators       : per-analysis detected indicators with severity (redacted)
se_findings      : social-engineering technique findings per analysis (redacted)
campaigns        : coordinated attack campaign registry
audit_logs       : append-only security audit trail linked by chained HMAC-SHA256 signatures
notifications    : in-app user alerts
threat_iocs      : SOC-managed custom Indicators of Compromise (domains, keywords, senders)
"""
import datetime as dt

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    event,
    text,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.security.crypto import EncryptedText

GENESIS_AUDIT_HASH = "0" * 64


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

    analyses = relationship(
        "Analysis",
        cascade="all, delete-orphan",
        back_populates="user",
        passive_deletes=True,
    )
    notifications = relationship(
        "Notification",
        cascade="all, delete-orphan",
        back_populates="user",
        passive_deletes=True,
    )


class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = (
        UniqueConstraint("user_id", "client_request_id", name="uq_analysis_user_request"),
        Index("ix_analyses_user_created", "user_id", "created_at"),
        Index("ix_analyses_risk_created", "risk_level", "created_at"),
        Index("ix_analyses_campaign_user", "campaign_signature", "user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    input_type = Column(String(32), nullable=False)  # text | url | screenshot
    content_hash = Column(String(64), nullable=False, index=True)
    # Zero-storage hash descriptor / redacted metadata encrypted at rest (NFR-02).
    content_snippet = Column(EncryptedText, nullable=False)
    client_request_id = Column(String(64), nullable=True, index=True)

    risk_score = Column(Integer, nullable=False)  # 0-100
    risk_level = Column(String(16), nullable=False)  # LOW | MEDIUM | HIGH | CRITICAL
    threat_type = Column(String(64), nullable=False, index=True)

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

    user = relationship("User", back_populates="analyses")
    indicators = relationship(
        "Indicator",
        cascade="all, delete-orphan",
        back_populates="analysis",
        lazy="joined",
        passive_deletes=True,
    )
    se_techniques = relationship(
        "SEFinding",
        cascade="all, delete-orphan",
        back_populates="analysis",
        lazy="joined",
        passive_deletes=True,
    )


class Indicator(Base):
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)

    category = Column(String(64), nullable=False)
    severity = Column(String(16), nullable=False)
    title = Column(String(255), nullable=False)
    detail = Column(EncryptedText, nullable=True)

    analysis = relationship("Analysis", back_populates="indicators")


class SEFinding(Base):
    """A detected social-engineering psychological technique."""

    __tablename__ = "se_findings"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)

    technique = Column(String(64), nullable=False)
    intensity = Column(String(16), nullable=False)  # NONE | LOW | MEDIUM | HIGH
    evidence = Column(EncryptedText, nullable=True)

    analysis = relationship("Analysis", back_populates="se_techniques")


class Campaign(Base):
    """A coordinated attack campaign detected via repeated IOC or template signatures."""

    __tablename__ = "campaigns"
    __table_args__ = (UniqueConstraint("signature", name="uq_campaign_signature"),)

    id = Column(Integer, primary_key=True, index=True)
    signature = Column(String(64), nullable=False, index=True)

    hits = Column(Integer, nullable=False, default=1)
    distinct_users = Column(Integer, nullable=False, default=1)
    severity = Column(String(16), nullable=False, default="MEDIUM")
    sample_snippet = Column(EncryptedText, nullable=True)

    first_seen = Column(DateTime(timezone=True), nullable=False, default=_now)
    last_seen = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class AuditLog(Base):
    """Append-only cryptographic security audit trail chained via HMAC-SHA256 (FR-10)."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    action = Column(String(64), nullable=False)
    resource = Column(String(128), nullable=True)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    meta = Column(JSON, nullable=True)
    prev_hash = Column(String(64), nullable=False, default=GENESIS_AUDIT_HASH)
    hmac_signature = Column(String(64), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)


@event.listens_for(AuditLog, "before_insert")
def _sign_audit_log_before_insert(mapper, connection, target: AuditLog) -> None:
    """Guarantee every AuditLog row is chained with HMAC-SHA256 even on direct ORM inserts."""
    from app.security.audit import compute_audit_hmac

    if target.created_at is None:
        target.created_at = _now()
    if target.meta is None:
        target.meta = {}
    if target.user_agent is not None:
        target.user_agent = target.user_agent[:255]

    if not target.hmac_signature:
        row = connection.execute(
            text("SELECT hmac_signature FROM audit_logs ORDER BY id DESC LIMIT 1")
        ).fetchone()
        prev_sig = row[0] if row and row[0] else GENESIS_AUDIT_HASH
        target.prev_hash = prev_sig
        target.hmac_signature = compute_audit_hmac(
            prev_hash=prev_sig,
            created_at=target.created_at,
            user_id=target.user_id,
            action=target.action,
            resource=target.resource,
            ip=target.ip,
            user_agent=target.user_agent,
            meta=target.meta,
        )


class Notification(Base):
    """In-app notifications for security events, detections, and alerts."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(String(1000), nullable=False)
    notification_type = Column(String(32), nullable=False, default="alert")
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)

    user = relationship("User", back_populates="notifications")


class ThreatIOC(Base):
    """SOC-managed Indicator of Compromise blocklist record (FR-12 & DFD D1)."""

    __tablename__ = "threat_iocs"
    __table_args__ = (
        UniqueConstraint("ioc_type", "value", name="uq_threat_ioc_type_value"),
    )

    id = Column(Integer, primary_key=True, index=True)
    ioc_type = Column(String(32), nullable=False, index=True)  # domain | keyword | sender
    value = Column(String(255), nullable=False, index=True)
    severity = Column(String(16), nullable=False, default="HIGH")
    description = Column(String(500), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)

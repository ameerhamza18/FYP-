"""Pydantic request/response schemas with strict input validation (OWASP API3/API4)."""
import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

_URL_RE = re.compile(
    r"https?://[^\s<>\"']+" , re.IGNORECASE
)


class RegisterIn(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        """OWASP-aligned policy: 8+ chars with upper, lower and digit."""
        if not (re.search(r"[A-Z]", v) and re.search(r"[a-z]", v) and re.search(r"\d", v)):
            raise ValueError("Password must contain uppercase, lowercase and digits")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    role: str
    is_active: bool


def _sanitize_text(v: str) -> str:
    """Strip control characters (except newlines/tabs) — basic injection hygiene."""
    return "".join(ch for ch in v if ch in ("\n", "\t") or ord(ch) >= 32)


class AnalyzeTextIn(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    source: str = Field(default="unknown", max_length=32)  # sms | whatsapp | email | other

    @field_validator("text")
    @classmethod
    def clean(cls, v: str) -> str:
        return _sanitize_text(v)


class AnalyzeUrlIn(BaseModel):
    url: str = Field(min_length=4, max_length=2048)

    @field_validator("url")
    @classmethod
    def looks_like_url(cls, v: str) -> str:
        v = v.strip()
        if not v.lower().startswith(("http://", "https://")):
            v = "http://" + v
        if not _URL_RE.match(v):
            raise ValueError("Invalid URL")
        return _sanitize_text(v)


class SEFindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    technique: str
    intensity: str
    evidence: Optional[str] = None


class IndicatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    category: str
    severity: str
    title: str
    detail: Optional[str] = None


class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    input_type: str
    risk_score: int
    risk_level: str
    threat_type: str
    ml_score: Optional[float] = None
    rule_score: Optional[float] = None
    intel_score: Optional[float] = None
    url_score: Optional[float] = None
    recommendation: str
    explanation: str
    explanation_source: str
    campaign_flagged: bool
    latency_ms: Optional[float] = None
    created_at: object


class AnalysisDetailOut(AnalysisOut):
    content_snippet: str
    engine_breakdown: Optional[dict] = None
    indicators: list[IndicatorOut] = []
    se_techniques: list[SEFindingOut] = []


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    signature: str
    hits: int
    distinct_users: int
    severity: str
    sample_snippet: Optional[str] = None
    first_seen: object
    last_seen: object


class AdminStatsOut(BaseModel):
    total_analyses: int
    high_risk: int
    phishing: int
    job_scams: int
    financial_fraud: int
    investment_scams: int
    prize_scams: int
    threat_trend: list[dict]
    top_techniques: list[dict]
    active_campaigns: int


class HealthOut(BaseModel):
    status: str
    app: str
    environment: str

/**
 * Wire types for the TrustLayer FastAPI backend.
 *
 * These mirror the Pydantic response models in `backend/app/schemas.py`
 * exactly (snake_case field names) so the UI never has to guess.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InputType = 'text' | 'url' | 'screenshot';

export interface Indicator {
  category: string;
  severity: string;
  title: string;
  detail?: string | null;
}

export interface SETechnique {
  technique: string;
  intensity: string;
  evidence?: string | null;
}

/** `AnalysisOut` — history rows. */
export interface Analysis {
  id: number;
  input_type: string;
  risk_score: number;
  risk_level: string;
  threat_type: string;
  ml_score?: number | null;
  rule_score?: number | null;
  intel_score?: number | null;
  url_score?: number | null;
  recommendation: string;
  explanation: string;
  explanation_source: string;
  campaign_flagged: boolean;
  latency_ms?: number | null;
  created_at: string;
}

/** `AnalysisDetailOut` — full report returned by every analyze endpoint. */
export interface AnalysisDetail extends Analysis {
  content_snippet: string;
  engine_breakdown?: Record<string, unknown> | null;
  indicators: Indicator[];
  se_techniques: SETechnique[];
}

/** `TokenOut`. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
}

/** `UserOut`. */
export interface User {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
}

export interface ThreatTrendPoint {
  date: string;
  total: number;
  high: number;
}

export interface TopTechnique {
  technique: string;
  count: number;
}

/** `AdminStatsOut`. */
export interface AdminStats {
  total_analyses: number;
  high_risk: number;
  phishing: number;
  job_scams: number;
  financial_fraud: number;
  investment_scams: number;
  prize_scams: number;
  threat_trend: ThreatTrendPoint[];
  top_techniques: TopTechnique[];
  active_campaigns: number;
}

/** `AdminAnalysisOut`. */
export interface AdminAnalysis {
  id: number;
  user_id: number;
  user_email?: string | null;
  input_type: string;
  risk_score: number;
  risk_level: string;
  threat_type: string;
  campaign_flagged: boolean;
  latency_ms?: number | null;
  content_snippet: string;
  created_at: string;
}

/** `AdminAnalysisPage`. */
export interface AdminAnalysisPage {
  total: number;
  limit: number;
  offset: number;
  items: AdminAnalysis[];
}

/** `CampaignOut`. */
export interface Campaign {
  id: number;
  signature: string;
  hits: number;
  distinct_users: number;
  severity: string;
  sample_snippet?: string | null;
  first_seen: string;
  last_seen: string;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  action: string;
  resource?: string | null;
  ip?: string | null;
  created_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface HealthResponse {
  status: string;
  app?: string;
  environment?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: 'alert' | 'campaign' | 'system';
  is_read: boolean;
  created_at: string;
}

export interface NotificationCount {
  unread_count: number;
}

export interface AdminMetrics {
  status: string;
  timestamp: string;
  database: { connection: string; total_analyses: number };
  users: { total: number; active: number };
  performance: {
    avg_latency_ms: number;
    high_critical_count: number;
    threat_ratio_pct: number;
  };
  ml_engine: {
    model_loaded: boolean;
    mode: string;
  };
}

export interface IncidentReport {
  report_id: string;
  platform: string;
  generated_at: string;
  investigator_account: string;
  integrity_hash: string;
  threat_assessment: {
    risk_score: number;
    risk_level: string;
    threat_type: string;
    input_type: string;
    campaign_correlated: boolean;
    campaign_signature?: string | null;
  };
  forensic_breakdown: {
    ml_probability?: number | null;
    rule_engine_score?: number | null;
    intel_score?: number | null;
    url_score?: number | null;
    indicators: Indicator[];
    social_engineering_tactics: SETechnique[];
  };
  verdict_summary: {
    technical_explanation: string;
    recommended_actions: string;
  };
  disclaimer: string;
}
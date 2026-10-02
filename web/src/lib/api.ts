/**
 * TrustLayer API client.
 *
 * Handles auth token injection, JSON/multipart bodies, and normalises every
 * failure into an {@link ApiError} carrying the HTTP status plus the backend's
 * human-readable `detail` message.
 */
import type {
  AdminAnalysisPage,
  AdminStats,
  AdminUser,
  Analysis,
  AnalysisDetail,
  AuditLog,
  Campaign,
  TokenResponse,
  User,
} from './types';

/**
 * Base URL of the API. `NEXT_PUBLIC_*` is inlined at build time, so the
 * Dockerfile passes it as a build arg (see infrastructure/docker/Dockerfile.web).
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';

export const TOKEN_KEY = 'trustlayer.token';
export const USER_KEY = 'trustlayer.user';

/** Broadcast when the API rejects a token so the UI can drop its session. */
export const UNAUTHORIZED_EVENT = 'trustlayer:unauthorized';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function storeUser(user: User): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

function notifyUnauthorized(): void {
  if (typeof window === 'undefined') return;
  clearSession();
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

async function parseError(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return `Request failed (${response.status})`;

  try {
    const body: unknown = JSON.parse(raw);
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === 'string') return detail;
      // FastAPI validation errors arrive as a list of {loc, msg, type}.
      if (Array.isArray(detail)) {
        const messages = detail
          .map((d) =>
            d && typeof d === 'object' && 'msg' in d
              ? String((d as { msg: unknown }).msg)
              : null,
          )
          .filter((m): m is string => Boolean(m));
        if (messages.length) return messages.join(', ');
      }
    }
  } catch {
    /* not JSON - fall through to the raw body */
  }

  return raw.slice(0, 300);
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Set for multipart uploads so the browser supplies the boundary. */
  formData?: FormData;
  /** Skip the Authorization header for the public auth endpoints. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, anonymous = false, signal } = options;

  const headers = new Headers({ Accept: 'application/json' });

  if (!anonymous) {
    const token = readStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let payload: BodyInit | undefined;
  if (formData) {
    // Never set Content-Type here: the browser must add the multipart boundary.
    payload = formData;
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: payload,
      signal,
      cache: 'no-store',
      credentials: 'include', // Ensure cookies are sent with every request
    });
  } catch {
    throw new ApiError(
      `Cannot reach the TrustLayer API at ${API_BASE_URL}. Is the backend running?`,
      0,
    );
  }

  if (response.status === 401) {
    notifyUnauthorized();
    throw new ApiError('Your session expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  auth: {
    /** Returns the created user; sign in separately to obtain a token. */
    register: (email: string, password: string) =>
      request<User>('/auth/register', {
        method: 'POST',
        body: { email, password },
        anonymous: true,
      }),
    login: (email: string, password: string) =>
      request<TokenResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
        anonymous: true,
      }),
    me: () => request<User>('/auth/me'),
  },
  analyze: {
    text: (text: string, source = 'web') =>
      request<AnalysisDetail>('/analyze/text', { method: 'POST', body: { text, source } }),
    url: (url: string) =>
      request<AnalysisDetail>('/analyze/url', { method: 'POST', body: { url } }),
    /** The multipart field name must match the backend param (`upload`). */
    screenshot: (file: File) => {
      const formData = new FormData();
      formData.append('upload', file, file.name || 'screenshot.png');
      return request<AnalysisDetail>('/analyze/screenshot', { method: 'POST', formData });
    },
    history: (limit = 20) => request<Analysis[]>(`/analyze/history?limit=${limit}`),
    detail: (id: number) => request<AnalysisDetail>(`/analyze/${id}`),
  },
  admin: {
    stats: () => request<AdminStats>('/admin/stats'),
    analyses: (
      params: { limit?: number; offset?: number; riskLevel?: string; inputType?: string } = {},
    ) => {
      const query = new URLSearchParams();
      query.set('limit', String(params.limit ?? 25));
      query.set('offset', String(params.offset ?? 0));
      if (params.riskLevel) query.set('risk_level', params.riskLevel);
      if (params.inputType) query.set('input_type', params.inputType);
      return request<AdminAnalysisPage>(`/admin/analyses?${query.toString()}`);
    },
    campaigns: () => request<Campaign[]>('/admin/campaigns'),
    auditLogs: (limit = 50) => request<AuditLog[]>(`/admin/audit-logs?limit=${limit}`),
    users: () => request<AdminUser[]>('/admin/users'),
    exportAuditLogsCsv: () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      const base = API_BASE_URL.replace(/\/api$/, '');
      const url = `${base}/api/admin/export/audit-logs/csv`;
      const a = document.createElement('a');
      a.href = token ? `${url}?token=${encodeURIComponent(token)}` : url;
      // Use fetch with auth header instead for security
      fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((r) => r.blob())
        .then((blob) => {
          const href = URL.createObjectURL(blob);
          a.href = href;
          a.download = 'trustlayer_audit_logs.csv';
          a.click();
          URL.revokeObjectURL(href);
        });
    },
    exportAnalysesCsv: () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      const base = API_BASE_URL.replace(/\/api$/, '');
      const url = `${base}/api/admin/export/analyses/csv`;
      fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((r) => r.blob())
        .then((blob) => {
          const href = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = href;
          a.download = 'trustlayer_threat_analyses.csv';
          a.click();
          URL.revokeObjectURL(href);
        });
    },
  },
};

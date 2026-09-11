"""In-memory sliding-window rate limiter (OWASP API4: Resource Consumption).

For a single-node deployment this middleware is sufficient; in multi-node
production deployments swap the ``_hits`` backend for Redis.
"""
import threading
import time
import urllib.parse
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.config import get_settings

settings = get_settings()

ANALYZE_PATHS = ("/api/analyze",)


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: Tuple[str, str], limit: int, window: float = 60.0) -> bool:
        now = time.monotonic()
        with self._lock:
            dq = self._hits[key]
            while dq and now - dq[0] > window:
                dq.popleft()
            if len(dq) >= limit:
                return False
            dq.append(now)
            return True


_limiter_singleton = None


def get_limiter() -> SlidingWindowRateLimiter:
    global _limiter_singleton
    if _limiter_singleton is None:
        _limiter_singleton = SlidingWindowRateLimiter()
    return _limiter_singleton


def client_ip(request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Applies per-IP, per-window limits; stricter limits on analysis endpoints."""

    async def dispatch(self, request, call_next) -> Response:
        if not settings.rate_limit_enabled:
            return await call_next(request)

        path = urllib.parse.urlparse(request.url.path).path
        ip = client_ip(request)

        if path.startswith("/api/analyze"):
            limit = settings.rate_limit_analyze_per_minute
            bucket = "analyze"
        elif path.startswith("/api/auth/login"):
            limit = max(5, settings.rate_limit_analyze_per_minute // 2)
            bucket = "login"
        elif path.startswith("/api/"):
            limit = settings.rate_limit_default_per_minute
            bucket = "api"
        else:
            return await call_next(request)

        if not get_limiter().allow((ip, bucket), limit):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Slow down and retry shortly."},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)

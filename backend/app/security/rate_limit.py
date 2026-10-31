"""Token-bucket & sliding-window rate limiters (NFR-03 / OWASP API4).

Enforces per-IP, per-bucket token-bucket rate limiting (default 60 req/min on
general API routes, stricter limits on /api/analyze and /api/auth/login), with
optional Redis coordination for multi-node deployments.
"""
import ipaddress
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


class TokenBucketRateLimiter:
    """Thread-safe Token Bucket rate limiter (NFR-03) with optional Redis support."""

    def __init__(self, redis_url: str = "") -> None:
        # key -> [tokens_remaining, last_refill_monotonic]
        self._buckets: Dict[Tuple[str, str], list] = {}
        self._lock = threading.Lock()
        self._redis = None
        if redis_url:
            try:
                import redis
                self._redis = redis.Redis.from_url(redis_url, socket_timeout=1.0)
                self._redis.ping()
            except Exception:
                self._redis = None

    def allow(self, key: Tuple[str, str], limit: int, window: float = 60.0) -> bool:
        if limit <= 0:
            return False

        if self._redis is not None:
            try:
                redis_key = f"tb:{key[0]}:{key[1]}"
                now = time.time()
                pipe = self._redis.pipeline()
                pipe.zremrangebyscore(redis_key, 0, now - window)
                pipe.zcard(redis_key)
                pipe.zadd(redis_key, {f"{now}:{time.perf_counter()}": now})
                pipe.expire(redis_key, int(window) + 5)
                res = pipe.execute()
                return res[1] < limit
            except Exception:
                pass  # Graceful fallback to in-memory token bucket

        now = time.monotonic()
        refill_rate = float(limit) / max(window, 0.001)
        with self._lock:
            state = self._buckets.get(key)
            if state is None:
                self._buckets[key] = [float(limit) - 1.0, now]
                return True

            tokens, last_ts = state
            elapsed = max(0.0, now - last_ts)
            tokens = min(float(limit), tokens + elapsed * refill_rate)
            if tokens < 1.0:
                state[0] = tokens
                state[1] = now
                return False

            state[0] = tokens - 1.0
            state[1] = now
            return True


class SlidingWindowRateLimiter(TokenBucketRateLimiter):
    """Backwards-compatible sliding-window limiter preserved for legacy callers."""

    def __init__(self, redis_url: str = "") -> None:
        super().__init__(redis_url=redis_url)
        self._hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)

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


def get_limiter() -> TokenBucketRateLimiter:
    global _limiter_singleton
    if _limiter_singleton is None:
        _limiter_singleton = TokenBucketRateLimiter(settings.redis_url)
    return _limiter_singleton


TRUSTED_PROXIES = {
    ipaddress.ip_network("127.0.0.1/32"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
}


def _is_trusted_proxy(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in net for net in TRUSTED_PROXIES)
    except ValueError:
        return False


def client_ip(request) -> str:
    direct_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and _is_trusted_proxy(direct_ip):
        return forwarded.split(",")[0].strip()
    return direct_ip


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Applies per-IP token-bucket limits (60 req/min default; stricter on analyze/login)."""

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

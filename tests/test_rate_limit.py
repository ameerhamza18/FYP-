"""Unit tests: rate limiter + preprocessing."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.security.rate_limit import SlidingWindowRateLimiter


def test_limiter_allows_under_limit():
    lim = SlidingWindowRateLimiter()
    for _ in range(5):
        assert lim.allow(("1.2.3.4", "analyze"), 5)


def test_limiter_blocks_over_limit():
    lim = SlidingWindowRateLimiter()
    for _ in range(5):
        lim.allow(("1.2.3.4", "analyze"), 5)
    assert not lim.allow(("1.2.3.4", "analyze"), 5)


def test_limiter_per_ip_isolation():
    lim = SlidingWindowRateLimiter()
    for _ in range(5):
        lim.allow(("1.1.1.1", "analyze"), 5)
    assert lim.allow(("2.2.2.2", "analyze"), 5)


def test_limiter_bucket_isolation():
    lim = SlidingWindowRateLimiter()
    for _ in range(5):
        lim.allow(("1.1.1.1", "analyze"), 5)
    assert lim.allow(("1.1.1.1", "api"), 5)

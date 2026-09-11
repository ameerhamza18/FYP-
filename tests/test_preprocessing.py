"""Unit tests: NLP preprocessing entity extraction."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.nlp import preprocessing


def test_extract_urls():
    urls = preprocessing.extract_urls(
        "verify at http://bad.xyz/login or https://good.com/x now")
    assert "http://bad.xyz/login" in urls
    assert "https://good.com/x" in urls


def test_extract_phones():
    phones = preprocessing.extract_phones("call 0300-1234567 or +92 315 7788992")
    assert len(phones) >= 1


def test_extract_otp():
    assert preprocessing.extract_entities("Your OTP is 483920")["otp_codes"]


def test_normalize():
    assert preprocessing.normalize("  Hello   WORLD \n") == "hello world"

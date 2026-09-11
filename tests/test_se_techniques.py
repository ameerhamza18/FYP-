"""Unit tests: social-engineering technique detection."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.nlp.se_techniques import detect_techniques, se_risk_score


def _names(text):
    return [f["technique"] for f in detect_techniques(text)]


def test_authority_detected():
    assert "Authority" in _names("I am from your bank, this is urgent")


def test_urgency_detected():
    assert "Urgency" in _names("Act within 10 minutes or lose access")


def test_fear_detected():
    assert "Fear" in _names("Your account will be blocked today")


def test_reward_detected():
    assert "Reward" in _names("You've won Rs. 50,000 in our lucky draw!")


def test_scarcity_detected():
    assert "Scarcity" in _names("Only 2 spots remaining for this offer")


def test_credential_harvesting_detected():
    assert "Credential Harvesting" in _names("Please enter your password and OTP to verify")


def test_financial_pressure_detected():
    assert "Financial Pressure" in _names("Pay the registration fee immediately via Easypaisa")


def test_clean_text_no_findings():
    assert detect_techniques("Hey, lunch tomorrow at 1pm?") == []


def test_high_intensity_scores_more():
    low = "You've won a prize"
    high = ("URGENT: act now within 10 minutes! You've won Rs. 50,000. "
            "Your account will be blocked. Enter your password and OTP now. "
            "Only 2 spots remaining. Pay immediately.")
    assert se_risk_score(detect_techniques(high)) > se_risk_score(detect_techniques(low))


def test_sorted_strongest_first():
    findings = detect_techniques(
        "Act now within 10 minutes! Your account will be blocked. "
        "I am from your bank. Enter your password.")
    assert len(findings) >= 2
    scores = [f["score"] for f in findings]
    assert scores == sorted(scores, reverse=True)

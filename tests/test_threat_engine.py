"""Unit tests: deterministic rule engine + threat intel + risk fusion."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.threat_engine import risk_scoring, threat_intel
from services.threat_engine.rule_engine import run_rules

BANKING_SCAM = ("Your ATM card has been blocked. Click here to reactivate "
                "immediately and enter your password.")
CLEAN = "Hi mom, I reached home safely, talk later tonight."


def test_rules_hit_on_scam():
    r = run_rules(BANKING_SCAM)
    assert r["hits"], "expected at least one rule hit"
    assert r["score"] > 0
    assert r["highest_severity"] in ("HIGH", "CRITICAL")
    assert r["threat_votes"]


def test_rules_clean_on_ham():
    r = run_rules(CLEAN)
    assert r["hits"] == []
    assert r["score"] == 0
    assert r["highest_severity"] is None


def test_rules_zero_day_pattern_still_caught():
    # A paraphrased scam never seen in training data — rules must still fire.
    r = run_rules("Kindly send the processing fee of Rs 3000 to confirm your employment offer today")
    assert r["score"] > 0


def test_intel_known_domain():
    r = threat_intel.check_text("claim now at http://prize-claim-center.tk/go")
    assert r["score"] > 0
    assert any(m["type"] == "domain" for m in r["matches"])


def test_intel_clean_text():
    assert threat_intel.check_text("meeting at 5pm")["score"] == 0


def test_intel_domain_lookup():
    assert threat_intel.check_domain("verify-account-alert.xyz")["score"] > 0
    assert threat_intel.check_domain("hbl.com")["score"] == 0


def test_fusion_critical_rule_floors_score():
    rule_result = {"hits": [1], "threat_votes": {"Phishing": 1}, "highest_severity": "CRITICAL"}
    v = risk_scoring.fuse_scores(ml_prob=0.1, rule_score=30, intel_score=0, url_score=None,
                                 rule_result=rule_result)
    assert v["risk_score"] >= 60
    assert v["risk_level"] in ("HIGH", "CRITICAL")


def test_fusion_clean_content():
    rule_result = {"hits": [], "threat_votes": {}, "highest_severity": None}
    v = risk_scoring.fuse_scores(ml_prob=0.02, rule_score=0, intel_score=0, url_score=None,
                                 rule_result=rule_result)
    assert v["risk_score"] < 30
    assert v["risk_level"] == "LOW"
    assert v["threat_type"] == "Clean / No Strong Threat"


def test_fusion_redistributed_weights_without_ml():
    # Cold start: no ML artifact — weights are redistributed, not dropped.
    rule_result = {"hits": [1], "threat_votes": {"Job Scam": 2}, "highest_severity": "HIGH"}
    v = risk_scoring.fuse_scores(ml_prob=None, rule_score=55, intel_score=0, url_score=None,
                                 rule_result=rule_result)
    assert v["weights_used"] == {"rules": 0.35, "intel": 0.20}
    assert v["threat_type"] == "Job Scam"

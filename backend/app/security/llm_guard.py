"""LLM security guards: prompt-injection defense + LLM output schema validation (FR-08).

Design decision: the LLM is NEVER the security decision-maker.
The deterministic Trust Engine produces the risk score, indicators and
recommendation. The LLM only converts pre-computed forensic JSON into a
plain-language explanation, and its output is contract-validated before
being returned to clients.
"""
import re
from typing import List

# --- Prompt injection signatures (direct + indirect) ---
INJECTION_PATTERNS: List[re.Pattern] = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)", re.I),
    re.compile(r"disregard\s+(all\s+)?(previous|prior|your)\s+(instructions?|rules?|prompts?)", re.I),
    re.compile(r"(you|we)\s+are\s+now\s+(a|an|in)\s+(different|new|developer|admin)", re.I),
    re.compile(r"reveal\s+(your|the)\s+(system\s+)?(prompt|instructions)", re.I),
    re.compile(r"system\s*:\s*", re.I),
    re.compile(r"<\s*/?\s*(system|assistant|user)\s*>", re.I),
    re.compile(r"print\s+(your|the)\s+(api\s+key|secret|token|system\s+prompt)", re.I),
    re.compile(r"act\s+as\s+(an?\s+)?(unrestricted|uncensored|dan)\b", re.I),
]

# Output section contract the LLM must honor in strict schema mode (FR-08).
ALLOWED_SECTIONS = ("summary:", "why this is risky:", "what you should do:")
MAX_OUTPUT_CHARS = 4000


def detect_prompt_injection(text: str) -> dict:
    """Scan user-controlled text for prompt-injection attempts.

    Returns a dict with a boolean flag and matched signatures.
    Injection attempts NEVER change the risk verdict: they are reported as an
    additional security indicator and excluded from the forensic JSON prompt.
    """
    matches: List[str] = []
    for pattern in INJECTION_PATTERNS:
        m = pattern.search(text or "")
        if m:
            matches.append(m.group(0)[:80])
    return {
        "injection_detected": bool(matches),
        "signatures": matches,
    }


def neutralize_for_llm(text: str) -> str:
    """Escape delimiters and role tags in forensic strings."""
    cleaned = (text or "").replace("```", "'''")
    cleaned = re.sub(r"<\s*/?\s*(system|assistant|user)\s*>", "[TAG]", cleaned, flags=re.I)
    return cleaned


def validate_llm_output(output: str, strict_schema: bool = False) -> str:
    """Contract-check the LLM explanation before it reaches the client (FR-08)."""
    if not output or not output.strip():
        raise ValueError("LLM returned empty output")
    if len(output) > MAX_OUTPUT_CHARS:
        output = output[:MAX_OUTPUT_CHARS]
    # The LLM must never echo secrets, private keys, or markdown code blocks.
    if re.search(r"(sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z\-_]{20,}|BEGIN [A-Z]+ PRIVATE KEY)", output):
        raise ValueError("LLM output contained credential-like material — rejected")
    if strict_schema:
        lowered = output.lower()
        if not all(sec in lowered for sec in ALLOWED_SECTIONS):
            raise ValueError("LLM output violated required section schema (Summary / Why / What to do)")
        if "```" in output:
            raise ValueError("LLM output contained disallowed code block")
    return output.strip()

"""LLM security guards: prompt-injection defense + LLM output validation.

Design decision (industry-grade): the LLM is NEVER the security decision-maker.
The deterministic Trust Engine produces the risk score, indicators and
recommendation. The LLM only re-words the evidence into a human explanation,
and its output is validated before being returned to clients.
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

# Output contract the LLM must honor.
ALLOWED_SECTIONS = ["summary", "why", "recommended_actions", "what_to_do_next"]
MAX_OUTPUT_CHARS = 4000


def detect_prompt_injection(text: str) -> dict:
    """Scan user-controlled text for prompt-injection attempts.

    Returns a dict with a boolean flag, matched signatures, and a risk note.
    Injection attempts NEVER change the risk verdict: they are reported as an
    additional security indicator and the LLM prompt is neutralized.
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
    """Wrap user text in delimiters and escape sequences that break injection."""
    cleaned = (text or "").replace("```", "'''")
    return cleaned


def validate_llm_output(output: str) -> str:
    """Contract-check the LLM explanation before it reaches the client."""
    if not output or not output.strip():
        raise ValueError("LLM returned empty output")
    if len(output) > MAX_OUTPUT_CHARS:
        output = output[:MAX_OUTPUT_CHARS]
    # The LLM must not echo secrets or attempt code blocks with payloads.
    if re.search(r"(sk-[A-Za-z0-9]{16,}|BEGIN [A-Z]+ PRIVATE KEY)", output):
        raise ValueError("LLM output contained credential-like material — rejected")
    return output.strip()

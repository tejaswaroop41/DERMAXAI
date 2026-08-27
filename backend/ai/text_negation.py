"""Small, conservative negation helper for rule-based clinical text scoring."""
import re

NEGATION_PATTERNS = (
    r"\bno\b",
    r"\bnot\b",
    r"\bdenies?\b",
    r"\bwithout\b",
    r"\bnegative for\b",
    r"\babsent\b",
)


def is_negated(text: str, start: int, *, window_chars: int = 48) -> bool:
    """Return True when a matched term is locally preceded by a negator.

    This intentionally uses a short local context instead of attempting full
    clinical parsing. It prevents common false positives such as "no bleeding"
    and "denies family history" while preserving positive mentions elsewhere.
    """
    prefix = text[max(0, start - window_chars):start]
    return any(re.search(pattern + r"[\s,:;-]*$", prefix) for pattern in NEGATION_PATTERNS)

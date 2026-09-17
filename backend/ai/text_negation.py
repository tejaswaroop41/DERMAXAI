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

# Common clause boundaries that should terminate a local negation scope.
# Auxiliary verbs such as "has" / "have" are intentionally excluded so
# constructions like "does not have a family history of melanoma" preserve
# the negation through the matched clinical term. Explicit conjunctions and
# punctuation can still terminate a scope when a later positive statement is
# introduced.
NEGATION_SCOPE_BREAKS = re.compile(
    r"\b(?:but|however|except|although|though|yet|now|currently|reports)\b"
)


def is_negated(text: str, start: int, *, window_tokens: int = 8) -> bool:
    """Return True when a matched term is locally preceded by a negator.

    The scope is token-based rather than character-suffix based so common
    clinical constructions such as ``no family history of melanoma`` and
    ``does not have a family history of melanoma`` are handled correctly.
    The scan stops at punctuation and common clause boundaries so a negation
    does not leak into a later positive statement. This remains intentionally
    conservative and is not a full clinical NLP parser.
    """
    prefix = text[:start].lower()
    # Keep only the current sentence/clause.
    prefix = re.split(r"[.!?\n]+", prefix)[-1]
    prefix = re.split(NEGATION_SCOPE_BREAKS, prefix)[-1]
    tokens = re.findall(r"\b[\w'-]+\b", prefix)
    context = " ".join(tokens[-window_tokens:])
    return any(re.search(pattern + r"(?:\s|$)", context) for pattern in NEGATION_PATTERNS)

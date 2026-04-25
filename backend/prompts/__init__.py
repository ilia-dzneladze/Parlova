from pathlib import Path

_DIR = Path(__file__).parent


def _load(name: str) -> str:
    return (_DIR / name).read_text(encoding="utf-8").rstrip("\n")


SAFETY_BLOCK = _load("safety.txt")
SYSTEM_PROMPT_TEMPLATE = _load("system_prompt.txt")
CONCLUSION_CHECK_PROMPT = _load("conclusion_check.txt")
GOODBYE_PROMPT = _load("goodbye.txt")
CORRECTOR_BASIC_PROMPT = _load("corrector_basic.txt")
CORRECTOR_EXPLAIN_PROMPT = _load("corrector_explain.txt")

LEVEL_RULES_RAW: dict[str, str] = {
    "A1": _load("level_rules/a1.txt"),
    "A2": _load("level_rules/a2.txt"),
    "B1": _load("level_rules/b1.txt"),
    "B2": _load("level_rules/b2.txt"),
    "C1": _load("level_rules/c1.txt"),
}

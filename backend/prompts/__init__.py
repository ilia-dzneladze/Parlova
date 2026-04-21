from pathlib import Path

_DIR = Path(__file__).parent


def _load(name: str) -> str:
    return (_DIR / name).read_text(encoding="utf-8").rstrip("\n")


SAFETY_BLOCK = _load("safety.txt")
SYSTEM_PROMPT_TEMPLATE = _load("system_prompt.txt")
QUEST_BLOCK_TEMPLATE = _load("quest_block.txt")
CONCLUSION_CHECK_PROMPT = _load("conclusion_check.txt")
GOODBYE_PROMPT = _load("goodbye.txt")

LEVEL_RULES_RAW: dict[str, str] = {
    "A1": _load("level_rules/a1.txt"),
    "A2": _load("level_rules/a2.txt"),
}

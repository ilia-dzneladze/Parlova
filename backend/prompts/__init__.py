from dataclasses import dataclass
from pathlib import Path

_DIR = Path(__file__).parent

SCOUT_FAMILY = "scout"
LLAMA33_FAMILY = "llama33"
GEMINI_FAMILY = "gemini"


def family_for_model(model: str | None) -> str:
    if model and "scout" in model.lower():
        return SCOUT_FAMILY
    if model == "gemini":
        return GEMINI_FAMILY
    return LLAMA33_FAMILY


def _load(path: Path) -> str:
    return path.read_text(encoding="utf-8").rstrip("\n")


@dataclass(frozen=True)
class TexterPrompts:
    safety_block: str
    system_template: str
    level_rules: dict[str, str]


@dataclass(frozen=True)
class CorrectorPrompts:
    basic: str
    explain: str


_LEVELS = ("A1", "A2", "B1", "B2", "C1")
_VOCAB_DIR = _DIR / "vocab"


def _load_vocab_block(level: str) -> str:
    parts = []
    prefer_path = _VOCAB_DIR / f"{level.lower()}_prefer.txt"
    avoid_path = _VOCAB_DIR / f"{level.lower()}_avoid.txt"
    if prefer_path.exists():
        parts.append(
            f"VOCABULARY ANCHOR — pull from this everyday {level} set when you can. "
            f"These are the words a real {level} speaker reaches for first. "
            f"This is a soft anchor, not a hard cage — close synonyms are fine if they sound natural.\n"
            + _load(prefer_path)
        )
    if avoid_path.exists():
        parts.append(
            f"AVOID — these are above-level for casual {level} chat. They make you sound like a textbook, not a friend. Don't reach for them:\n"
            + _load(avoid_path)
        )
    return "\n\n".join(parts)


def _load_texter(family: str) -> TexterPrompts:
    base = _DIR / family
    level_rules: dict[str, str] = {}
    for lvl in _LEVELS:
        rules = _load(base / "level_rules" / f"{lvl.lower()}.txt")
        vocab_block = _load_vocab_block(lvl)
        if vocab_block:
            rules = rules + "\n\n" + vocab_block
        level_rules[lvl] = rules
    return TexterPrompts(
        safety_block=_load(base / "safety.txt"),
        system_template=_load(base / "system_prompt.txt"),
        level_rules=level_rules,
    )


def _load_corrector(family: str) -> CorrectorPrompts:
    base = _DIR / family
    return CorrectorPrompts(
        basic=_load(base / "corrector_basic.txt"),
        explain=_load(base / "corrector_explain.txt"),
    )


_TEXTER_CACHE: dict[str, TexterPrompts] = {}
_CORRECTOR_CACHE: dict[str, CorrectorPrompts] = {}


def get_texter_prompts(model: str | None) -> TexterPrompts:
    family = family_for_model(model)
    if family not in _TEXTER_CACHE:
        _TEXTER_CACHE[family] = _load_texter(family)
    return _TEXTER_CACHE[family]


def get_corrector_prompts(model: str | None) -> CorrectorPrompts:
    family = family_for_model(model)
    if family not in _CORRECTOR_CACHE:
        _CORRECTOR_CACHE[family] = _load_corrector(family)
    return _CORRECTOR_CACHE[family]


CONCLUSION_CHECK_PROMPT = _load(_DIR / "conclusion_check.txt")
GOODBYE_PROMPT = _load(_DIR / "goodbye.txt")

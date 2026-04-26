import json
import re
from typing import Literal, TypedDict

from ..llm_properties import DEFAULT_MODEL
from ..llm_client import chat_complete
from ..prompts import get_corrector_prompts


_VALID_LEVELS = {"A1", "A2", "B1", "B2", "C1"}
_CONTEXT_TURNS = 6

# Strip everything that texting users vary freely on: punctuation, casing,
# diacritic-free comparison is intentionally NOT applied (umlauts matter).
_NORMALIZE_RE = re.compile(r"[\s\.,;:!\?\-–—\"'`´‚‘’“”«»\(\)\[\]\{\}…]+")


def _texting_equivalent(a: str, b: str) -> bool:
    """True if `a` and `b` differ only in punctuation, whitespace, or casing."""
    norm_a = _NORMALIZE_RE.sub("", a).casefold()
    norm_b = _NORMALIZE_RE.sub("", b).casefold()
    return norm_a == norm_b


class CorrectionResult(TypedDict, total=False):
    status: Literal["good", "corrected"]
    corrected: str


def _normalize_level(level: str | None) -> str:
    if level and level.upper() in _VALID_LEVELS:
        return level.upper()
    return "A1"


def _build_context(history: list[dict]) -> list[dict]:
    """Take the last few turns to give the corrector conversational context."""
    if not history:
        return []
    recent = history[-_CONTEXT_TURNS:]
    out: list[dict] = []
    for msg in recent:
        sender = msg.get("sender")
        content = msg.get("content", "")
        if not content:
            continue
        role = "user" if sender == "user" else "assistant"
        out.append({"role": role, "content": content})
    return out


def _extract_json(text: str) -> dict | None:
    if not text:
        return None
    text = text.strip()
    # Strip code fences if the model added them despite instructions
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
    return None


def correct_message(
    user_message: str,
    history: list[dict],
    level: str,
    model: str | None = None,
) -> CorrectionResult:
    """Returns {'status': 'good'} or {'status': 'corrected', 'corrected': '...'}.

    Conservative: any failure mode (parse error, identical correction, empty
    output) collapses to 'good' so the user is never shown a wrong tip.
    """
    user_message = (user_message or "").strip()
    if not user_message:
        return {"status": "good"}

    level = _normalize_level(level)
    resolved_model = model or DEFAULT_MODEL
    prompts = get_corrector_prompts(resolved_model)
    system_prompt = prompts.basic.format(level=level)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(_build_context(history))
    messages.append({"role": "user", "content": user_message})

    try:
        raw = chat_complete(
            messages,
            model_choice=resolved_model,
            max_tokens=200,
            temperature=0.1,
            json_mode=True,
        )
    except Exception:
        return {"status": "good"}

    data = _extract_json(raw)
    if not data:
        return {"status": "good"}

    status = data.get("status")
    if status == "corrected":
        corrected = (data.get("corrected") or "").strip()
        if not corrected or corrected == user_message:
            return {"status": "good"}
        # Texting etiquette: ignore punctuation/casing-only "corrections".
        if _texting_equivalent(corrected, user_message):
            return {"status": "good"}
        return {"status": "corrected", "corrected": corrected}

    return {"status": "good"}


def explain_correction(
    original: str,
    corrected: str,
    history: list[dict],
    level: str,
    model: str | None = None,
) -> str:
    """Generate a detailed Markdown explanation of the correction."""
    level = _normalize_level(level)
    resolved_model = model or DEFAULT_MODEL
    prompts = get_corrector_prompts(resolved_model)
    system_prompt = prompts.explain.format(level=level)

    context = _build_context(history)
    context_str = "\n".join(
        f"{'User' if m['role'] == 'user' else 'Partner'}: {m['content']}" for m in context
    ) or "(start of conversation)"

    user_block = (
        f"Recent conversation:\n{context_str}\n\n"
        f"User wrote: {original}\n"
        f"Corrected: {corrected}\n\n"
        f"Explain the correction following the format and language ratio for level {level}."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_block},
    ]

    return chat_complete(
        messages,
        model_choice=resolved_model,
        max_tokens=400,
        temperature=0.3,
    ).strip()

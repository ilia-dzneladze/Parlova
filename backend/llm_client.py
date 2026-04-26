"""Unified LLM transport layer.

Routes chat-completion calls to either Anthropic Haiku 4.5 (via Vertex /
Gemini Enterprise Agent Platform) or OpenAI GPT-4.1-mini, based on the
caller-supplied `model_choice` (or `ACTIVE_MODEL` env fallback).

This module is the only place that talks to provider SDKs. Agents call
`chat_complete(...)` and get back a plain string.
"""

import os
from typing import Literal

from anthropic import AnthropicVertex
from google import genai
from google.genai import types as genai_types
from openai import OpenAI

ModelChoice = Literal["haiku", "gpt4mini", "gemini"]

_VALID_CHOICES: tuple[str, ...] = ("haiku", "gpt4mini", "gemini")
_DEFAULT_CHOICE: ModelChoice = "gemini"

_HAIKU_MODEL_ID = "claude-haiku-4-5@20251001"
_HAIKU_REGION = "global"
_GPT4MINI_MODEL_ID = "gpt-4.1-mini"
_GEMINI_MODEL_ID = "gemini-2.5-flash"
_GEMINI_REGION = "global"

_JSON_MODE_INSTRUCTION = (
    "You MUST respond with a single valid JSON object and nothing else. "
    "No prose, no markdown, no code fences, no commentary."
)

_anthropic_client: AnthropicVertex | None = None
_openai_client: OpenAI | None = None


def _get_anthropic() -> AnthropicVertex:
    global _anthropic_client
    if _anthropic_client is None:
        project_id = os.getenv("GCP_PROJECT_ID")
        if not project_id:
            raise RuntimeError("GCP_PROJECT_ID env var is required for Haiku/Vertex")
        _anthropic_client = AnthropicVertex(project_id=project_id, region=_HAIKU_REGION)
    return _anthropic_client


def _get_openai() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY env var is required for GPT-4.1-mini")
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def _get_gemini() -> "genai.Client":
    """Construct a fresh Gemini client per call.

    The google-genai SDK keeps a long-lived httpx client internally; under
    uvicorn auto-reload that client can land in a CLOSED state, raising
    "Cannot send a request, as the client has been closed." on the next call.
    Building fresh per request is essentially free (no network until
    generate_content) and sidesteps the reload hazard entirely.
    """
    project_id = os.getenv("GCP_PROJECT_ID")
    if not project_id:
        raise RuntimeError("GCP_PROJECT_ID env var is required for Gemini/Vertex")
    return genai.Client(vertexai=True, project=project_id, location=_GEMINI_REGION)


def _to_gemini_contents(messages: list[dict]) -> list:
    """Convert OpenAI-style messages to Gemini content format.

    Gemini uses role "model" instead of "assistant" and wraps text in `parts`.
    System messages are stripped here — they're hoisted into `system_instruction`
    by `_split_system` upstream.
    """
    contents = []
    for m in messages:
        role = m.get("role")
        if role == "system":
            continue
        gemini_role = "model" if role == "assistant" else "user"
        contents.append(
            genai_types.Content(role=gemini_role, parts=[genai_types.Part(text=m.get("content") or "")])
        )
    return contents


def resolve_model_choice(raw: str | None) -> ModelChoice:
    """Map an arbitrary frontend `model` string to a valid ModelChoice.

    Anything not in the literal set falls back to ACTIVE_MODEL, then to
    the hardcoded default.
    """
    if raw in _VALID_CHOICES:
        return raw  # type: ignore[return-value]
    env = os.getenv("ACTIVE_MODEL", _DEFAULT_CHOICE)
    if env in _VALID_CHOICES:
        return env  # type: ignore[return-value]
    return _DEFAULT_CHOICE


def _split_system(messages: list[dict], system: str) -> tuple[str, list[dict]]:
    """Separate leading system messages (persona) from trailing ones (in-context).

    Texter constructs `chat_messages = [{"role":"system", persona}, ...user/asst...]`
    and sometimes appends another system message at the tail (conclusion check,
    goodbye prompt). The leading persona belongs in the provider's top-level
    system field; the trailing one is an instruction *about the conversation
    that just happened*, and must be the final turn for the model to act on it
    — so we inline those as a user turn.
    """
    sys_parts: list[str] = []
    if system:
        sys_parts.append(system)
    cleaned: list[dict] = []
    seen_non_system = False
    for m in messages:
        role = m.get("role")
        content = m.get("content") or ""
        if role == "system":
            if not seen_non_system:
                if content:
                    sys_parts.append(content)
            else:
                if content:
                    cleaned.append({"role": "user", "content": content})
        else:
            seen_non_system = True
            cleaned.append(m)
    return "\n\n".join(sys_parts), cleaned


def chat_complete(
    messages: list[dict],
    *,
    system: str = "",
    model_choice: str | None = None,
    max_tokens: int = 1024,
    temperature: float | None = None,
    top_p: float | None = None,
    json_mode: bool = False,
) -> str:
    """Run a chat completion against the chosen provider; return assistant text."""
    choice = resolve_model_choice(model_choice)

    if choice == "haiku":
        merged_system, user_messages = _split_system(messages, system)
        if json_mode:
            merged_system = (
                f"{merged_system}\n\n{_JSON_MODE_INSTRUCTION}".strip()
            )
        kwargs: dict = {
            "model": _HAIKU_MODEL_ID,
            "max_tokens": max_tokens,
            "messages": user_messages,
        }
        if merged_system:
            kwargs["system"] = merged_system
        if temperature is not None:
            kwargs["temperature"] = temperature
        if top_p is not None:
            kwargs["top_p"] = top_p
        resp = _get_anthropic().messages.create(**kwargs)
        # Anthropic returns a list of content blocks; join all text blocks.
        parts = [getattr(b, "text", "") for b in resp.content if getattr(b, "type", "") == "text"]
        return "".join(parts)

    if choice == "gpt4mini":
        oai_messages: list[dict] = []
        if system:
            oai_messages.append({"role": "system", "content": system})
        oai_messages.extend(messages)
        kwargs = {
            "model": _GPT4MINI_MODEL_ID,
            "messages": oai_messages,
            "max_tokens": max_tokens,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        if top_p is not None:
            kwargs["top_p"] = top_p
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = _get_openai().chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""

    # gemini
    merged_system, user_messages = _split_system(messages, system)
    contents = _to_gemini_contents(user_messages)
    # Disable thinking — 2.5 Flash otherwise burns the token budget on
    # `thoughts_token_count` before producing any visible text, which breaks
    # tight callers like `_check_conclusion(max_tokens=5)`.
    config_kwargs: dict = {
        "max_output_tokens": max_tokens,
        "thinking_config": genai_types.ThinkingConfig(thinking_budget=0),
    }
    if merged_system:
        config_kwargs["system_instruction"] = merged_system
    if temperature is not None:
        config_kwargs["temperature"] = temperature
    if top_p is not None:
        config_kwargs["top_p"] = top_p
    if json_mode:
        config_kwargs["response_mime_type"] = "application/json"
    # Hold a local reference: SyncHttpxClient.__del__ closes its httpx client,
    # so a temporary `_get_gemini()` can be collected mid-call, raising
    # "Cannot send a request, as the client has been closed."
    gemini = _get_gemini()
    resp = gemini.models.generate_content(
        model=_GEMINI_MODEL_ID,
        contents=contents,
        config=genai_types.GenerateContentConfig(**config_kwargs),
    )
    return resp.text or ""

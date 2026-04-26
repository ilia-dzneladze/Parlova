import os
from dotenv import load_dotenv

load_dotenv()

from dataclasses import dataclass, field
from enum import Enum

from .prompts import family_for_model, get_texter_prompts

DEFAULT_SCENARIO = "Just Chatting"

_JUST_CHATTING_BLOCK = (
    "No specific scenario — just a casual, friendly conversation. "
    "No task, no goal. Just chat naturally."
)


class Level(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"


@dataclass
class Persona:
    """User-facing identity of a conversation partner."""
    name: str
    persona: str  # Rich character description
    level: Level = Level.A1
    question_freq: float = 0.5  # 0.0 = never asks follow-ups, 1.0 = always
    scenario: str = field(default=DEFAULT_SCENARIO)


_MAX_TOKENS: dict[Level, int] = {
    Level.A1: 350,
    Level.A2: 350,
    Level.B1: 400,
    Level.B2: 450,
    Level.C1: 500,
}

DEFAULT_MODEL = os.getenv("ACTIVE_MODEL", "gemini")


@dataclass(frozen=True)
class SamplingConfig:
    temperature: float | None = None
    top_p: float | None = None


_SAMPLING: dict[str, SamplingConfig] = {
    "scout": SamplingConfig(),
    "llama33": SamplingConfig(temperature=0.85, top_p=0.9),
}


def sampling_for(model: str | None) -> SamplingConfig:
    return _SAMPLING.get(family_for_model(model), SamplingConfig())


def sampling_kwargs(sampling: SamplingConfig) -> dict:
    out: dict = {}
    if sampling.temperature is not None:
        out["temperature"] = sampling.temperature
    if sampling.top_p is not None:
        out["top_p"] = sampling.top_p
    return out


def _build_scenario_block(scenario: str) -> str:
    if not scenario or scenario.strip() == DEFAULT_SCENARIO:
        return _JUST_CHATTING_BLOCK
    return (
        scenario.strip()
        + "\nStay in this context naturally. Don't announce or explain the scenario — just live it."
    )


def _question_freq_phrase(freq: float) -> str:
    if freq <= 0.3:
        return (
            "You rarely end a reply with a question — only when you're genuinely curious. "
            "Most of your replies just react and share, no question."
        )
    if freq < 0.6:
        return (
            "You sometimes end a reply with a question, but often you just react and share without one. "
            "Don't interrogate the user."
        )
    return (
        "You often end your replies with a question — you're a curious person who actually wants to know. "
        "But not every single reply: leave some replies as a pure reaction or share, so it doesn't feel like an interview."
    )


def build_system_prompt_texter(persona: Persona, model: str | None = None) -> str:
    prompts = get_texter_prompts(model)
    return prompts.system_template.format(
        safety_block=prompts.safety_block,
        persona_name=persona.name,
        persona_persona=persona.persona,
        persona_level=persona.level.value,
        scenario_block=_build_scenario_block(persona.scenario),
        level_rules=prompts.level_rules[persona.level.value],
        question_freq_phrase=_question_freq_phrase(persona.question_freq),
    )


class Agent:
    def __init__(
        self,
        model: str,
        system_prompt: str,
        max_token: int,
        sampling: SamplingConfig,
        max_context: int = 0,
    ):
        self.model = model
        self.system_prompt = system_prompt
        self.max_token = max_token
        self.sampling = sampling
        self.max_context = max_context


def create_texter(persona: Persona, model: str | None = None) -> Agent:
    resolved = model or DEFAULT_MODEL
    return Agent(
        model=resolved,
        system_prompt=build_system_prompt_texter(persona, resolved),
        max_token=_MAX_TOKENS.get(persona.level, 400),
        sampling=sampling_for(resolved),
        max_context=5000,
    )

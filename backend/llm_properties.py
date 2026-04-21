import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

from dataclasses import dataclass, field
from enum import Enum

from .prompts import SAFETY_BLOCK, SYSTEM_PROMPT_TEMPLATE, LEVEL_RULES_RAW

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


LEVEL_RULES: dict[Level, str] = {
    Level.A1: LEVEL_RULES_RAW["A1"],
    Level.A2: LEVEL_RULES_RAW["A2"],
    Level.B1: LEVEL_RULES_RAW["B1"],
    Level.B2: LEVEL_RULES_RAW["B2"],
    Level.C1: LEVEL_RULES_RAW["C1"],
}

_MAX_TOKENS: dict[Level, int] = {
    Level.A1: 350,
    Level.A2: 350,
    Level.B1: 400,
    Level.B2: 450,
    Level.C1: 500,
}

DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def _build_scenario_block(scenario: str) -> str:
    if not scenario or scenario.strip() == DEFAULT_SCENARIO:
        return _JUST_CHATTING_BLOCK
    return (
        scenario.strip()
        + "\nStay in this context naturally. Don't announce or explain the scenario — just live it."
    )


def build_system_prompt_texter(persona: Persona) -> str:
    return SYSTEM_PROMPT_TEMPLATE.format(
        safety_block=SAFETY_BLOCK,
        persona_name=persona.name,
        persona_persona=persona.persona,
        persona_level=persona.level.value,
        scenario_block=_build_scenario_block(persona.scenario),
        level_rules=LEVEL_RULES[persona.level],
    )


class Agent:
    def __init__(self, model: str, system_prompt: str, max_token: int, max_context: int = 0):
        self.model = model
        self.system_prompt = system_prompt
        self.max_token = max_token
        self.max_context = max_context


def create_texter(persona: Persona, model: str = DEFAULT_MODEL) -> Agent:
    return Agent(
        model=model,
        system_prompt=build_system_prompt_texter(persona),
        max_token=_MAX_TOKENS.get(persona.level, 400),
        max_context=5000,
    )

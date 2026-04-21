import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

from dataclasses import dataclass
from enum import Enum

from .prompts import SAFETY_BLOCK, SYSTEM_PROMPT_TEMPLATE, QUEST_BLOCK_TEMPLATE, LEVEL_RULES_RAW


class Level(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"


@dataclass
class Persona:
    """User-facing identity of a conversation partner."""
    name: str
    persona: str  # Rich character description
    level: Level = Level.A1
    question_freq: float = 0.5  # 0.0 = never asks follow-ups, 1.0 = always


LEVEL_RULES: dict[Level, str] = {
    Level.A1: LEVEL_RULES_RAW["A1"],
    Level.A2: LEVEL_RULES_RAW["A2"],
    # B1, B2, etc.
}

DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def build_system_prompt_texter(persona: Persona, quest=None) -> str:
    """Compose a system prompt from persona + level rules + optional quest."""
    quest_block = ""
    if quest:
        facts_lines = "\n".join(
            f"  - {f.key}: {f.value} — context: {f.reveal_hint}"
            for f in quest.persona_facts
        )
        quest_block = (
            "\n"
            + QUEST_BLOCK_TEMPLATE.format(
                facts_lines=facts_lines,
                end_goal_description=quest.end_goal.description,
            )
            + "\n"
        )

    return SYSTEM_PROMPT_TEMPLATE.format(
        safety_block=SAFETY_BLOCK,
        persona_name=persona.name,
        persona_persona=persona.persona,
        persona_level=persona.level.value,
        quest_block=quest_block,
        level_rules=LEVEL_RULES[persona.level],
    )


# Agent stays generic - it doesn't know about personas
class Agent:
    def __init__(self, model: str, system_prompt: str, max_token: int, max_context: int = 0):
        self.model = model
        self.system_prompt = system_prompt
        self.max_token = max_token
        self.max_context = max_context


# Factory that wires persona -> agent
def create_texter(persona: Persona, model: str = DEFAULT_MODEL, quest=None) -> Agent:
    return Agent(
        model=model,
        system_prompt=build_system_prompt_texter(persona, quest),
        max_token=350 if persona.level in (Level.A1, Level.A2) else 400,
        max_context=5000,
    )



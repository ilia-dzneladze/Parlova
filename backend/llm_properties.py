import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

from dataclasses import dataclass, field
from enum import Enum


class Level(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"


@dataclass
class Persona:
    """User-facing identity of a conversation partner."""
    name: str
    bio: str  # e.g. "Studentin aus München, liebt Wandern"
    level: Level = Level.A1
    topics: list[str] = field(default_factory=lambda: [
        "Name", "Alter", "Wohnort", "Hobbys", "Familie"
    ])
    traits: list[str] = field(default_factory=list)  # e.g. ["freundlich", "neugierig"]


# Base prompt templates per level — the actual linguistic constraints
LEVEL_RULES: dict[Level, str] = {
    Level.A1: """
- Nur A1 Niveau: einfache Wörter, kurze Sätze (max 8 Wörter pro Satz).
- Maximal 1-2 Sätze pro Antwort.
- KEINE Nebensätze mit "weil", "dass", "obwohl" usw.
- KEINE Vergangenheitsformen außer "war" und "hatte".
- KEIN Konjunktiv. KEIN Passiv.
- Wenn der Nutzer Fehler macht, ignoriere sie. Korrigiere NICHT.
""",
    Level.A2: """
- A2 Niveau: einfache aber etwas längere Sätze erlaubt.
- Maximal 2-3 Sätze pro Antwort.
- Einfache Nebensätze mit "weil" und "dass" sind OK.
- Perfekt ist erlaubt, aber kein Präteritum außer "war/hatte/ging".
- KEIN Konjunktiv. KEIN Passiv.
- Wenn der Nutzer Fehler macht, ignoriere sie. Korrigiere NICHT.
""",
    # B1, B2, etc.
}


def build_system_prompt(persona: Persona) -> str:
    """Compose a system prompt from persona + level rules."""
    topics_str = ", ".join(persona.topics)
    traits_str = ", ".join(persona.traits) if persona.traits else "freundlich"

    return f"""Du heißt {persona.name}. {persona.bio}
Du bist {traits_str}.
Du führst ein Gespräch auf Deutsch mit einem Sprachlernenden.

Regeln:
- Nur Deutsch. Keine Übersetzungen. Kein Englisch. Niemals.
{LEVEL_RULES[persona.level]}
- Themen: {topics_str}.
- Stelle immer eine einfache Frage zurück.
- Bleib in deiner Rolle als {persona.name}. Brich nie den Charakter.
"""


# Agent stays generic — it doesn't know about personas
class Agent:
    def __init__(self, model: str, system_prompt: str, max_token: int, max_context: int = 0):
        self.model = model
        self.system_prompt = system_prompt
        self.max_token = max_token
        self.max_context = max_context


# Factory that wires persona -> agent
def create_texter(persona: Persona, model: str = "llama-3.1-8b-instant") -> Agent:
    return Agent(
        model=model,
        system_prompt=build_system_prompt(persona),
        max_token=200 if persona.level in (Level.A1, Level.A2) else 400,
        max_context=1200,
    )

# You ship some defaults
penelope = Persona(
    name="Penelope",
    bio="Studentin aus München. Studiert Kunst.",
    level=Level.A1,
    traits=["freundlich", "neugierig"],
)

texter_agent = create_texter(penelope)

sanity_checker = Agent(
    model="llama-3.1-8b-instant", 
    system_prompt="You are a German language quality checker. Rate the following German text on a scale of 1-10 for grammatical correctness and naturalness. Respond with ONLY a single integer, nothing else.",
    max_token=3
)
"""Quest generation for Parlova conversation quests.

A quest gives structure to a conversation: the agent has facts to reveal,
the user has a goal to accomplish, and at the end we test comprehension.
"""

import os
import random
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .llm_properties import Level

# ── Load templates once at import time ──────────────────────────────────

_TEMPLATE_PATH = Path(__file__).parent / "quest_templates.yaml"

with open(_TEMPLATE_PATH, "r", encoding="utf-8") as f:
    _RAW = yaml.safe_load(f)

_SLOTS: dict[str, list[str]] = _RAW["slots"]
_TEMPLATES: dict[str, list[dict]] = {
    k: v for k, v in _RAW.items() if k != "slots"
}


# ── Data classes ────────────────────────────────────────────────────────

@dataclass
class PersonaFact:
    key: str          # e.g. "studiert"
    label: str        # e.g. "What she studies" — shown in the case-file briefing
    value: str        # e.g. "Kunst" (already filled)
    reveal_hint: str  # instruction for the LLM on when to reveal this


@dataclass
class EndGoal:
    description: str        # shown to the user in the briefing
    success_criteria: str   # instruction for the LLM evaluator


@dataclass
class DebriefQuestion:
    type: str        # "true_false" or "fill_blank"
    question: str    # e.g. "Lena studiert ___"
    answer: str      # e.g. "Kunst" or "true"/"false"


@dataclass
class Quest:
    id: str
    level: str
    topic: str
    persona_facts: list[PersonaFact]
    end_goal: EndGoal
    debrief: list[DebriefQuestion]

    def briefing_text(self, persona_name: str) -> str:
        """Human-readable briefing for the frontend case-file card."""
        facts_lines = [f"- {f.label}" for f in self.persona_facts]
        return (
            f"You're texting with {persona_name}.\n"
            f"Topic: {self.topic}\n"
            f"\n"
            + "\n".join(facts_lines) + "\n"
            f"\n"
            f"Goal: {self.end_goal.description}"
        )

    def to_dict(self, persona_name: str) -> dict:
        """Serialise the full quest for storage on the client (answers included).

        The client (SQLite on device) is the source of truth — the backend is
        stateless and reconstructs Quest objects from the data the client sends back.
        """
        return {
            "id": self.id,
            "level": self.level,
            "topic": self.topic,
            "briefing": self.briefing_text(persona_name),
            "end_goal": self.end_goal.description,
            "persona_facts": [
                {"key": f.key, "label": f.label, "value": f.value, "reveal_hint": f.reveal_hint}
                for f in self.persona_facts
            ],
            "debrief": [
                {"type": q.type, "question": q.question, "answer": q.answer}
                for q in self.debrief
            ],
        }


# ── Slot filling ────────────────────────────────────────────────────────

def _fill_slots(text: str, filled: dict[str, str]) -> str:
    """Replace {slot} placeholders with concrete values."""
    result = text
    for key, val in filled.items():
        result = result.replace(f"{{{key}}}", val)
    return result


def _resolve_slots(template: dict, persona_name: str) -> dict[str, str]:
    """Pick a random value for every slot referenced in the template.

    We do a simple scan of the entire YAML subtree for {placeholder} patterns
    and resolve them all from the slot pools.
    """
    import re

    raw = yaml.dump(template, allow_unicode=True)
    placeholders = set(re.findall(r"\{(\w+)\}", raw))

    filled: dict[str, str] = {"name": persona_name}

    for ph in placeholders:
        if ph == "name":
            continue
        pool = _SLOTS.get(ph)
        if pool:
            filled[ph] = random.choice(pool)

    return filled


# ── Public API ──────────────────────────────────────────────────────────

def generate_quest(level: Level, persona_name: str) -> Quest:
    """Pick a random quest template for the given level and fill it in."""
    level_key = level.value  # "A1", "A2", etc.
    templates = _TEMPLATES.get(level_key)
    if not templates:
        # Fall back to A1 if no templates exist for this level yet
        templates = _TEMPLATES["A1"]

    template = random.choice(templates)
    filled = _resolve_slots(template, persona_name)

    persona_facts = [
        PersonaFact(
            key=f["key"],
            label=_fill_slots(f["label"], filled),
            value=_fill_slots(f["value"], filled),
            reveal_hint=_fill_slots(f["reveal_hint"], filled),
        )
        for f in template["persona_facts"]
    ]

    eg = template["end_goal"]
    end_goal = EndGoal(
        description=_fill_slots(eg["description"], filled),
        success_criteria=_fill_slots(eg["success_criteria"], filled),
    )

    debrief = []
    for q in template["debrief"]:
        answer = q["answer"]
        # true_false answers are booleans in YAML — convert to string
        if isinstance(answer, bool):
            answer = "true" if answer else "false"
        else:
            answer = _fill_slots(str(answer), filled)

        debrief.append(DebriefQuestion(
            type=q["type"],
            question=_fill_slots(q["question"], filled),
            answer=answer,
        ))

    return Quest(
        id=_fill_slots(template["id"], filled),
        level=level_key,
        topic=_fill_slots(template["topic"], filled),
        persona_facts=persona_facts,
        end_goal=end_goal,
        debrief=debrief,
    )


def quest_from_dict(data: dict) -> Quest:
    """Reconstruct a Quest from the dict the client sends back on each message."""
    return Quest(
        id=data["id"],
        level=data["level"],
        topic=data["topic"],
        persona_facts=[
            PersonaFact(key=f["key"], label=f.get("label", f["key"]), value=f["value"], reveal_hint=f["reveal_hint"])
            for f in data.get("persona_facts", [])
        ],
        end_goal=EndGoal(
            description=data["end_goal"],
            success_criteria="",  # not needed during chat
        ),
        debrief=[
            DebriefQuestion(type=q["type"], question=q["question"], answer=q.get("answer", ""))
            for q in data.get("debrief", [])
        ],
    )


def evaluate_quest(quest: Quest, user_answers: list[str]) -> dict:
    """Score the user's debrief answers against the quest.

    Returns {score, max_score, results: [{question, user_answer, correct_answer, correct}]}
    """
    results = []
    score = 0

    for q, user_ans in zip(quest.debrief, user_answers):
        if q.type == "true_false":
            correct = user_ans.strip().lower() == q.answer.lower()
        else:
            # fill_blank: case-insensitive, trimmed comparison
            correct = user_ans.strip().lower() == q.answer.strip().lower()

        if correct:
            score += 1

        results.append({
            "question": q.question,
            "user_answer": user_ans,
            "correct_answer": q.answer,
            "correct": correct,
        })

    return {
        "score": score,
        "max_score": len(quest.debrief),
        "results": results,
    }

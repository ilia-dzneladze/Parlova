import os
import re
from typing import Optional

from pydantic import BaseModel
from .app import main_loop
from .llm_properties import Persona, Level
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PONS_API_KEY = os.getenv("PONS_API_KEY", "")


class PersonaRequest(BaseModel):
    name: str
    persona: str
    level: str = "A1"
    question_freq: float = 0.5

class MessageRequest(BaseModel):
    message: str
    history: list = []
    persona: Optional[PersonaRequest] = None
    message_count: int = 0


@app.post("/api/chat")
async def chat(request: MessageRequest):
    persona = None
    if request.persona:
        p = request.persona
        persona = Persona(
            name=p.name,
            persona=p.persona,
            level=Level(p.level),
            question_freq=p.question_freq,
        )
    response_text, follow_up, wrap_up, elapsed = main_loop(
        request.message, request.history, persona, request.message_count,
    )
    return {
        "response": response_text,
        "follow_up": follow_up,
        "wrap_up": wrap_up,
        "time": elapsed,
    }


@app.get("/api/dictionary/{word}")
async def dictionary_lookup(word: str):
    if not PONS_API_KEY:
        raise HTTPException(status_code=500, detail="PONS API key not configured")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.pons.com/v1/dictionary",
                params={"l": "deen", "q": word, "language": "de"},
                headers={"X-Secret": PONS_API_KEY},
                timeout=10.0,
            )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach PONS API")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Word not found")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"PONS API error: {resp.status_code}")

    data = resp.json()

    result: dict = {
        "word": word,
        "translations": [],
        "partOfSpeech": None,
        "gender": None,
        "example": None,
    }

    try:
        hits = data[0]["hits"] if data else []
        for hit in hits:
            if hit.get("type") != "entry":
                continue
            roms = hit.get("roms", [])
            if not roms:
                continue
            rom = roms[0]

            hw_full = rom.get("headword_full", "")
            if not result["partOfSpeech"]:
                for pos in ["SUBST", "V", "ADJ", "ADV", "PREP", "KONJ", "PRON", "ART"]:
                    if f">{pos}</acronym>" in hw_full or f">{pos}<" in hw_full:
                        result["partOfSpeech"] = pos
                        break
            if not result["gender"]:
                gender_match = re.search(r'class="genus".*?>(m|f|nt)<', hw_full)
                if gender_match:
                    g = gender_match.group(1)
                    result["gender"] = {"m": "masculine", "f": "feminine", "nt": "neuter"}[g]

            for arab in rom.get("arabs", []):
                for translation in arab.get("translations", []):
                    source_raw = translation.get("source", "")
                    target = _clean_pons(translation.get("target", ""))
                    if not target:
                        continue
                    # Headword-only entries have class="headword" in source
                    is_headword = 'class="headword"' in source_raw
                    source = _clean_pons(source_raw)

                    if is_headword:
                        if target not in result["translations"]:
                            result["translations"].append(target)
                    elif not result["example"]:
                        result["example"] = f"{source} — {target}"

            if result["translations"]:
                break
    except (IndexError, KeyError, TypeError):
        pass

    if not result["translations"]:
        raise HTTPException(status_code=404, detail="No translations found")

    return result


_ABBREVIATIONS = {
    "etw": "etwas",
    "jdm": "jemandem",
    "jdn": "jemanden",
    "jds": "jemandes",
    "sb": "somebody",
    "sb's": "somebody's",
    "sth": "something",
    "ugs": "informal",
    "Dat": "dative",
    "Akk": "accusative",
    "Pl": "plural",
    "o.": "or",
    "Am": "American English",
    "Brit": "British English",
}

# Matches a standalone abbreviation (whole word)
_ABBR_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in _ABBREVIATIONS) + r")\b"
)


def _clean_pons(text: str) -> str:
    """Strip HTML tags, decode entities, and expand abbreviations."""
    import html
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = _ABBR_PATTERN.sub(lambda m: _ABBREVIATIONS[m.group(0)], text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

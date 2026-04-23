import asyncio
import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Optional

from pydantic import BaseModel
from .app import main_loop
from .llm_properties import Persona, Level, DEFAULT_SCENARIO
import yaml
from fastapi import FastAPI, Header, HTTPException, UploadFile, File
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
PERSONAS_API_KEY = os.getenv("PERSONAS_API_KEY", "")
_PERSONAS_DIR = Path(__file__).parent / "prompts" / "personas"

# ── Local kaikki dictionary DB ───────────────────────────────────────────────
_DICT_DB_PATH = Path(__file__).parent.parent / "dictionary" / "parlova_dict.db"
_dict_conn: sqlite3.Connection | None = None


def _get_dict_conn() -> sqlite3.Connection | None:
    global _dict_conn
    if _dict_conn is None and _DICT_DB_PATH.exists():
        _dict_conn = sqlite3.connect(str(_DICT_DB_PATH), check_same_thread=False)
    return _dict_conn


def _filter_example(example: str | None) -> str | None:
    if not example:
        return None
    if "ſ" in example:
        return None
    if example.rstrip().endswith("—"):
        return None
    return example


def _extract_headline(translations: list[str]) -> str | None:
    if not translations:
        return None
    first = translations[0]
    m = re.search(r":\s*(.+)$", first)
    if m:
        return m.group(1).strip() or None
    if " of " not in first and len(first) <= 40:
        return first.split(";")[0].strip() or None
    return None


def _extract_root_word(translations: list[str]) -> str | None:
    for t in translations:
        m = re.search(r"\bof\s+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß-]*)(?:\s*:|$|\s)", t)
        if m:
            return m.group(1).lower()
    return None


def _kaikki_lookup(word: str, direction: str, _depth: int = 0) -> dict | None:
    conn = _get_dict_conn()
    if conn is None:
        return None
    key = word.strip().lower()
    if direction == "de":
        row = conn.execute(
            "SELECT word, pos, gender, translations, example FROM de_entries WHERE word = ?",
            (key,),
        ).fetchone()
        if not row:
            return None
        translations = json.loads(row[3])
        headline = _extract_headline(translations)
        root_word = _extract_root_word(translations) if _depth == 0 else None
        root = _kaikki_lookup(root_word, "de", _depth + 1) if root_word and root_word != key else None
        return {
            "word": row[0],
            "translations": translations,
            "partOfSpeech": row[1],
            "gender": row[2],
            "example": _filter_example(row[4]),
            "headline": headline,
            "root": root,
        }
    else:
        row = conn.execute(
            "SELECT word, pos, translations FROM en_entries WHERE word = ?",
            (key,),
        ).fetchone()
        if not row:
            return None
        translations = json.loads(row[2])
        return {
            "word": row[0],
            "translations": translations,
            "partOfSpeech": row[1],
            "gender": None,
            "example": None,
            "headline": _extract_headline(translations),
            "root": None,
        }


class PersonaRequest(BaseModel):
    name: str
    persona: str
    level: str = "A1"
    question_freq: float = 0.5
    scenario: str = DEFAULT_SCENARIO

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
            scenario=p.scenario,
        )
    bubbles, closing, wrap_up, elapsed = main_loop(
        request.message, request.history, persona, request.message_count,
    )
    return {
        "bubbles": bubbles,
        "closing": closing,
        "wrap_up": wrap_up,
        "time": elapsed,
    }


@app.get("/api/personas")
async def get_personas(x_api_key: str = Header(default="")):
    if PERSONAS_API_KEY and x_api_key != PERSONAS_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    result = []
    for f in sorted(_PERSONAS_DIR.glob("*.yaml")):
        data = yaml.safe_load(f.read_text(encoding="utf-8"))
        result.append({
            "id": data["id"],
            "name": data["name"],
            "description": data["description"].strip(),
            "level": data["level"],
            "questionFreq": data["question_freq"],
            "avatarColor": data["avatar_color"],
            "source": "global",
            "globalId": data["id"],
        })
    return result


@app.get("/api/dictionary/{word}")
async def dictionary_lookup(word: str, direction: str = "de"):
    result = await asyncio.to_thread(_kaikki_lookup, word, direction)
    if result:
        return result

    if not PONS_API_KEY:
        raise HTTPException(status_code=404, detail="Word not found")

    lang_pair = "deen" if direction == "de" else "ende"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.pons.com/v1/dictionary",
                params={"l": lang_pair, "q": word},
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
    pons: dict = {
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
            if not pons["partOfSpeech"]:
                for pos in ["SUBST", "V", "ADJ", "ADV", "PREP", "KONJ", "PRON", "ART"]:
                    if f">{pos}</acronym>" in hw_full or f">{pos}<" in hw_full:
                        pons["partOfSpeech"] = pos
                        break
            if not pons["gender"]:
                gender_match = re.search(r'class="genus".*?>(m|f|nt)<', hw_full)
                if gender_match:
                    g = gender_match.group(1)
                    pons["gender"] = {"m": "masculine", "f": "feminine", "nt": "neuter"}[g]

            for arab in rom.get("arabs", []):
                for translation in arab.get("translations", []):
                    source_raw = translation.get("source", "")
                    target = _clean_pons(translation.get("target", ""))
                    if not target:
                        continue
                    is_headword = 'class="headword"' in source_raw
                    source = _clean_pons(source_raw)
                    if is_headword:
                        if target not in pons["translations"]:
                            pons["translations"].append(target)
                    elif not pons["example"]:
                        pons["example"] = f"{source} — {target}"

            if pons["translations"]:
                break
    except (IndexError, KeyError, TypeError):
        pass

    if not pons["translations"]:
        raise HTTPException(status_code=404, detail="No translations found")

    pons["headline"] = _extract_headline(pons["translations"])
    pons["root"] = None
    return pons


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

_ABBR_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in _ABBREVIATIONS) + r")\b"
)


# ── DEBUG — remove when done ─────────────────────────────────────────────────
import shutil

@app.post("/debug/upload-db")
async def debug_upload_db(file: UploadFile = File(...)):
    out = Path(__file__).parent.parent / "parlova_debug.db"
    with open(out, "wb") as f:
        shutil.copyfileobj(file.file, f)
    print(f"\n✅  DB saved to {out}\n")
    return {"status": "ok", "saved_to": str(out)}
# ─────────────────────────────────────────────────────────────────────────────


def _clean_pons(text: str) -> str:
    import html
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = _ABBR_PATTERN.sub(lambda m: _ABBREVIATIONS[m.group(0)], text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

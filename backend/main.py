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
from .translate import SUPPORTED_LANGUAGES, translate_text
import yaml
from fastapi import FastAPI, Header, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    model: Optional[str] = None


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
        request.message, request.history, persona, request.message_count, request.model,
    )
    return {
        "bubbles": bubbles,
        "closing": closing,
        "wrap_up": wrap_up,
        "time": elapsed,
    }


class TranslateRequest(BaseModel):
    text: str
    source: str = "de"
    target: str = "en"


@app.post("/api/translate")
async def translate_endpoint(request: TranslateRequest):
    source = request.source.lower()
    target = request.target.lower()
    if source not in SUPPORTED_LANGUAGES or target not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Only {sorted(SUPPORTED_LANGUAGES)} supported; got {source}->{target}",
        )
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    try:
        translated = await asyncio.to_thread(translate_text, request.text, source, target)  # type: ignore[arg-type]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Translation failed: {e}")
    return {"translated": translated, "source": source, "target": target}


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


@app.get("/api/lookup/{word}")
async def lookup_word(word: str, direction: str = "de"):
    if direction not in ("de", "en"):
        raise HTTPException(status_code=400, detail="direction must be 'de' or 'en'")
    cleaned = word.strip().lower()
    if not cleaned:
        raise HTTPException(status_code=400, detail="word is required")

    dict_entry = await asyncio.to_thread(_kaikki_lookup, cleaned, direction)
    if dict_entry:
        return {**dict_entry, "source": "dict"}

    src: str = direction
    tgt: str = "en" if direction == "de" else "de"
    try:
        translated = await asyncio.to_thread(translate_text, cleaned, src, tgt)  # type: ignore[arg-type]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Translation failed: {e}")
    if not translated:
        raise HTTPException(status_code=404, detail="Word not found")

    return {
        "word": cleaned,
        "translations": [translated],
        "partOfSpeech": None,
        "gender": None,
        "example": None,
        "headline": None,
        "root": None,
        "source": "translate",
    }


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

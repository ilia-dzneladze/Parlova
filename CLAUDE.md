# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Parlova is a German language learning mobile app. Users chat with an A1-level AI tutor through a React Native (Expo) frontend backed by a Python FastAPI server that calls the Groq LLM API.

## Development Commands

### Backend
```bash
# Activate venv and start backend + ngrok tunnel (patches Chat.tsx with new URL)
./start_backend.sh

# Or run uvicorn directly (from project root, with venv activated)
uvicorn backend.main:app --reload --reload-include '*.yaml'
```

### Frontend
```bash
cd frontend && npx expo start --tunnel
```

### Setup
```bash
python3 -m venv myenv && source myenv/bin/activate && pip install -r requirements.txt
cd frontend && npm install
```

## Architecture

**Two-process system**: FastAPI backend (port 8000, tunneled via ngrok) + Expo React Native frontend.

### Backend (`backend/`)
- `main.py` — FastAPI app. Endpoints: `POST /api/chat`, `POST /api/quest/generate`, `POST /api/quest/evaluate`, `GET /api/dictionary/{word}`.
- `app.py` — Routing layer that delegates to agents.
- `llm_properties.py` — Groq client, `Persona` dataclass, `Agent` class, `LEVEL_RULES`, and `build_system_prompt_texter`. The system prompt structure: SAFETY_BLOCK → WHO YOU ARE (explicit name + persona text) → WHAT YOU ARE DOING → optional QUEST block → HOW TO REPLY.
- `agents/texter.py` — Main conversation agent. Makes up to 3 LLM calls per turn: (1) main reply, (2) optional conclusion check, (3) optional follow-up question. The follow-up call prioritizes asking the user's name if it hasn't come up yet.
- `agents/sanity_check.py` — Stub; not wired into the main flow yet.
- `quests.py` — Quest generation from YAML templates. Fills slot placeholders with random values.
- `quest_templates.yaml` — A1/A2 quest templates with `persona_facts`, `end_goal`, and `debrief` questions.

### Frontend (`frontend/`)
- `App.tsx` — React Navigation stack with Home and Chat screens.
- `components/Home.tsx` — Landing screen.
- `components/Chat.tsx` — Chat interface. Contains `API_BASE` constant that `start_backend.sh` auto-patches with the ngrok URL via sed. Sends the full persona object (name, persona text, level, question_freq) to the backend on every message.
- `src/db/database.ts` — expo-sqlite wrapper. `initDB()` creates tables and runs persona migrations. `seedIfEmpty()` seeds the Penelope conversation on first launch. `PENELOPE_PERSONA` is defined at module level so the migration in `initDB` can always update existing rows.
- `constants/theme.ts` — Font family constants.

### Persona architecture
- The `persona` field in the `conversations` SQLite table is a plain-text character description string.
- `database.ts` exports `PENELOPE_PERSONA` (the canonical rich description for Penelope Dupont) and `initDB` runs `UPDATE conversations SET persona = ? WHERE name = 'Penelope'` on every launch to keep it current.
- The backend's `build_system_prompt_texter` prepends `"Your name is {persona.name}. Any other people mentioned in your backstory are different people."` to prevent the model from confusing the character's name with her roommate's (Lukas).
- **Penelope's key details**: Pénélope "Penny" Dupont, 20, from Lyon, lives in Neukölln, UdK art student (Mixed Media & Installation), barista at "Kaffee Schwarz" in Kreuzberg, roommate = Lukas (engineering student), hobbies: Nikon F3 film photography, Mauerpark flea market, Spotify playlists, techno clubs. Coffee snob. Uses French filler words ("bref", "enfin", "putain").

### Key integration detail
`start_backend.sh` dynamically rewrites the `API_BASE` constant in `Chat.tsx` with the current ngrok tunnel URL on every backend start. Don't hardcode this value—it changes each session.

## API Endpoints (from README)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/conversations` | Start a new session, get greeting |
| `POST` | `/conversations/{id}/messages` | Send a message, get a reply |
| `GET` | `/conversations/{id}` | Get conversation history |

Note: The current codebase implements only `POST /api/chat`. The REST endpoints above are the target API design from the README.

## Tech Stack
- **Frontend**: Expo ~54, React Native 0.81, React Navigation 7, TypeScript 5.9
- **Backend**: FastAPI, Groq API (llama-3.1-8b-instant), Python 3.10+
- **Tunneling**: ngrok (free tier)
- **LLM**: All prompts are in German; the texter agent is constrained to A1-level vocabulary

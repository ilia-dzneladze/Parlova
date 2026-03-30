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
- `main.py` — FastAPI app with single `POST /api/chat` endpoint. Accepts `{message, history}`, returns `{response, time}`.
- `app.py` — Routing layer that delegates to agents.
- `llm_properties.py` — Groq client setup and `Agent` class definitions. Two agents configured: `texter_agent` (A1 German conversation) and `sanity_checker` (grammar rating).
- `agents/texter.py` — Builds chat message array from history and calls Groq API. Returns response text and elapsed time.
- `agents/sanity_check.py` — Stub; not wired into the main flow yet.

### Frontend (`frontend/`)
- `App.tsx` — React Navigation stack with Home and Chat screens.
- `components/Home.tsx` — Landing screen.
- `components/Chat.tsx` — Chat interface. Contains `API_BASE` constant that `start_backend.sh` auto-patches with the ngrok URL via sed.
- `constants/theme.ts` — Font family constants.

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

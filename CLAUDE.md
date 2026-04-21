# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working style

**Ask before implementing.** If a task has ambiguity that would affect the design or quality of the solution — missing context, multiple valid approaches, unclear scope — ask the user targeted questions before writing any code. A brief clarifying exchange produces better output than a confident wrong implementation.

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

- **`main.py`** — FastAPI app. Implemented endpoints:
  - `POST /api/chat` — main conversation turn
  - `POST /api/quest/generate` — generate a quest from YAML templates
  - `GET /api/dictionary/{word}` — PONS API lookup with HTML parsing and abbreviation handling
- **`app.py`** — Routing layer; delegates `/api/chat` to `agents/texter.py`.
- **`llm_properties.py`** — Groq client, `Persona` dataclass, `Level` enum (A1/A2/B1/B2), `Agent` dataclass, `LEVEL_RULES` dict, `build_system_prompt_texter(persona, quest=None)`, `create_texter()` factory. Default model: `meta-llama/llama-4-scout-17b-16e-instruct`. System prompt structure: SAFETY_BLOCK → WHO YOU ARE → WHAT YOU ARE DOING → optional QUEST block → HOW TO REPLY.
- **`agents/texter.py`** — Main conversation agent. Makes up to 3 LLM calls per turn: (1) main reply, (2) optional conclusion check via `_check_conclusion()`, (3) optional goodbye via `_generate_goodbye()`. Includes `_looks_off_topic()` heuristic to guard against jailbreaks. Starts checking for wrap-up at message_count ≥ 10, forces it at ≥ 20. Returns `(response, follow_up, wrap_up_flag, elapsed_time)`.
- **`quests.py`** — Quest generation and evaluation. Dataclasses: `PersonaFact`, `EndGoal`, `DebriefQuestion`, `Quest`. Key functions: `generate_quest(level, persona_name)`, `quest_from_dict(data)`, `evaluate_quest(quest, user_answers)`. Note: `evaluate_quest` is not wired to a FastAPI endpoint — it's called internally.
- **`quest_templates.yaml`** — A1 and A2 quest templates. Each template has: `id`, `topic`, `persona_facts` (3–4 facts), `end_goal`, `debrief` (3 questions). Slot placeholders are filled with random values at generation time.

### Frontend (`frontend/`)

#### Navigation
`App.tsx` — Bottom tab navigator (HomeTab, Conversations, Me, Settings) with a stack overlay (Chat, ArchiveList, ArchiveChat, WordList). Loads Bricolage Grotesque and DM Sans fonts via `expo-google-fonts`.

#### Screens & Components
- **`components/HomeScreen.tsx`** — Main home screen with hero section and CTA.
- **`components/ConversationsList.tsx`** — Lists all active conversations with avatars, last message preview, and unread indicator.
- **`components/Chat.tsx`** — Chat interface. Contains `API_BASE` constant auto-patched by `start_backend.sh`. Handles message bubbles (grouped, with timestamps), typing indicator, quest briefing/debrief lifecycle, and dictionary lookups via a bottom sheet modal. Sends full persona object on every message.
- **`components/ArchiveList.tsx`** — List of archived conversations.
- **`components/ArchiveChat.tsx`** — Read-only view of an archived conversation.
- **`components/MeScreen.tsx`** — User profile and stats.
- **`components/SettingsScreen.tsx`** — App settings.
- **`components/WordList.tsx`** — Saved vocabulary review screen.
- **`components/QuestBriefing.tsx`** — Modal shown before a quest begins; displays the case file.
- **`components/QuestDebrief.tsx`** — Modal shown after a quest ends; presents debrief questions and scores answers.

#### Data & Utilities
- **`src/db/database.ts`** — expo-sqlite wrapper. Six tables: `conversations`, `messages`, `archived_conversations`, `archived_messages`, `dictionary_cache`, `dictionary_usage`. `initDB()` creates tables and runs persona migrations. `seedIfEmpty()` seeds the Penelope conversation on first launch. Quest storage: `saveQuestForConversation`, `getQuestForConversation`, `clearQuestForConversation`. Dictionary: `searchDictCache`, `getDictEntry`, `saveDictEntry`, `getDictionaryUsage`, `incrementDictionaryUsage`.
- **`src/types/conversation.ts`** — `Conversation` and `ArchivedConversation` interfaces.
- **`src/types/quest.ts`** — `PersonaFact`, `DebriefQuestion`, `Quest`, `DebriefResult`, `EvaluationResult` interfaces.
- **`src/types/navigation.ts`** — `RootStackParamList` (Tabs, Chat, ArchiveList, ArchiveChat, WordList) and `TabParamList` (HomeTab, Conversations, Me, Settings).
- **`src/utils/chat.ts`** — `Message` type, `SENT_COLOR`/`RECV_COLOR` (sourced from `COLORS.bubbleSent`/`COLORS.bubbleRecv`), `DEFAULT_GREETING`, `formatTime`, `isLastInGroup`, `isFirstInGroup`, `showTimestamp`.
- **`constants/theme.ts`** — Full design system: `COLORS`, `FONTS`, `SIZES`, `SPACING`, `RADIUS`, `SHADOWS`. All component code must import from here — never use raw hex or font strings inline. AI bubble color: `COLORS.bubbleRecv`. Header/footer dividers: `COLORS.borderInput`. Internal/card borders: `COLORS.border`.

### Persona architecture
- The `persona` field in the `conversations` SQLite table is a plain-text character description string.
- `database.ts` exports `PENELOPE_PERSONA` (the canonical rich description) and `initDB` runs `UPDATE conversations SET persona = ? WHERE name = 'Penelope'` on every launch to keep it current.
- The backend's `build_system_prompt_texter` prepends `"Your name is {persona.name}. Any other people mentioned in your backstory are different people."` to prevent the model from confusing the character's name with her roommate's (Lukas).
- `question_freq` (0.0–1.0) on the persona controls how often the texter agent appends a follow-up question.
- **Penelope's key details**: Pénélope "Penny" Dupont, 20, from Lyon, lives in Neukölln, UdK art student (Mixed Media & Installation), barista at "Kaffee Schwarz" in Kreuzberg, roommate = Lukas (engineering student), hobbies: Nikon F3 film photography, Mauerpark flea market, Spotify playlists, techno clubs. Coffee snob. Uses French filler words ("bref", "enfin", "putain").

### Key integration detail
`start_backend.sh` dynamically rewrites the `API_BASE` constant in `Chat.tsx` with the current ngrok tunnel URL on every backend start. Don't hardcode this value — it changes each session.

## Tech Stack
- **Frontend**: Expo ~54, React Native 0.81, React Navigation 7, TypeScript 5.9
- **Backend**: FastAPI, Groq API (llama-4-scout-17b-16e-instruct), Python 3.10+
- **Tunneling**: ngrok (free tier)
- **LLM**: All prompts are in German; the texter agent is constrained to A1-level vocabulary

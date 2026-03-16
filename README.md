# Parlova

A German language learning app. Chat with Penelope, an A1-level AI tutor, through a React Native mobile app.

## Prerequisites

- Python 3.10+
- Node.js 18+
- [ngrok](https://ngrok.com/download) (free account)
- A [Groq API key](https://console.groq.com)

## Setup

**1. Clone and enter the repo**
```bash
git clone <repo-url>
cd Parlova
```

**2. Create the env file**
```bash
cp .env.example .env
# open .env and paste your Groq API key
```

**3. Set up the Python environment**
```bash
python3 -m venv myenv
source myenv/bin/activate
pip install -r requirements.txt
```

**4. Install frontend dependencies**
```bash
cd frontend && npm install && cd ..
```

**5. Install the Expo Go app** on your phone from the App Store / Play Store.

## Running

Open two terminals from the project root.

**Terminal 1 — backend + tunnel**
```bash
./start_backend.sh
```
Starts the API server, opens an ngrok tunnel, and patches the frontend with the new URL automatically.

**Terminal 2 — frontend**
```bash
cd frontend && npx expo start --tunnel
```
Scan the QR code with Expo Go.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/conversations` | Start a new session, get Anna's greeting |
| `POST` | `/conversations/{id}/messages` | Send a message, get a reply |
| `GET` | `/conversations/{id}` | Get conversation history |

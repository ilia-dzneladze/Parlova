#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

source myenv/bin/activate

# Kill any leftover uvicorn or ngrok from a previous run
fuser -k 8000/tcp 2>/dev/null || true
pkill -f "ngrok http" 2>/dev/null || true
sleep 1

# Start uvicorn
uvicorn backend.main:app --reload --reload-include '*.yaml' &
UVICORN_PID=$!

# Start ngrok, write JSON logs to a file we control
rm -f /tmp/ngrok_parlova.log
ngrok http 8000 --log=stdout --log-format=json > /tmp/ngrok_parlova.log 2>&1 &
NGROK_PID=$!

# Parse the tunnel URL directly from the log file (works regardless of API port)
echo "Waiting for ngrok tunnel..."
NGROK_URL=""
for i in {1..15}; do
    NGROK_URL=$(python3 - <<'EOF'
import json
try:
    for line in open('/tmp/ngrok_parlova.log'):
        try:
            d = json.loads(line.strip())
            if d.get('url', '').startswith('https'):
                print(d['url'])
                break
        except Exception:
            pass
except Exception:
    pass
EOF
)
    [ -n "$NGROK_URL" ] && break
    sleep 1
done

if [ -z "$NGROK_URL" ]; then
    echo "ERROR: Could not get ngrok URL."
    echo "--- ngrok log ---"
    cat /tmp/ngrok_parlova.log
    kill $UVICORN_PID $NGROK_PID 2>/dev/null
    exit 1
fi

# Patch ChatScreen.tsx
sed -i "s|const API_BASE = '.*'|const API_BASE = '$NGROK_URL'|" frontend/components/Chat.tsx

echo ""
echo "  Backend : $NGROK_URL"
echo "  Chat.tsx patched with new URL"
echo ""
echo "  Now run in a second terminal:"
echo "    cd frontend && npx expo start --tunnel"
echo ""
echo "  Ctrl+C to stop everything"

trap "echo 'Stopping...'; kill $UVICORN_PID $NGROK_PID 2>/dev/null" EXIT INT
wait

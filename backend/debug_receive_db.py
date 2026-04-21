"""
TEMPORARY DEBUG SCRIPT — delete this file when done.

Starts a minimal FastAPI endpoint that receives the SQLite file uploaded
by DEBUG_SendDB.tsx and saves it as parlova_debug.db in the project root.

Run separately from the main backend:
    source myenv/bin/activate
    python backend/debug_receive_db.py

Then open parlova_debug.db with DB Browser for SQLite.
"""

import shutil
import uvicorn
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OUTPUT_PATH = "parlova_debug.db"


@app.post("/debug/upload-db")
async def upload_db(file: UploadFile = File(...)):
    with open(OUTPUT_PATH, "wb") as f:
        shutil.copyfileobj(file.file, f)
    print(f"\n✅  Saved to {OUTPUT_PATH}  —  open with DB Browser for SQLite\n")
    return {"status": "ok", "saved_to": OUTPUT_PATH}


if __name__ == "__main__":
    print("Waiting for DB upload on port 8001...")
    print("Make sure ngrok is also forwarding port 8001, or temporarily use port 8000.\n")
    uvicorn.run(app, host="0.0.0.0", port=8001)

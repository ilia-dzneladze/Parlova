from pydantic import BaseModel
from .app import main_loop
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MessageRequest(BaseModel):
    message: str
    history: list = []

@app.post("/api/chat")
async def chat(request: MessageRequest):
    response_text, elapsed = main_loop(request.message, request.history)
    return {
        "response": response_text,
        "time": elapsed
    }
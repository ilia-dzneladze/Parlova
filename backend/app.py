from .agents.texter import send_message
from .llm_properties import Persona

def main_loop(question, history=[], persona: Persona | None = None, message_count: int = 0, model: str | None = None):
    bubbles, closing, wrap_up, elapsed = send_message(question, history, persona, message_count, model)
    return bubbles, closing, wrap_up, elapsed

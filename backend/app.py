from .agents.texter import send_message
from .llm_properties import Persona

def main_loop(question, history=[], persona: Persona | None = None, message_count: int = 0, quest=None):
    response, follow_up, wrap_up, elapsed = send_message(question, history, persona, message_count, quest=quest)
    return response, follow_up, wrap_up, elapsed

from .agents.texter import send_message
from .llm_properties import Persona

def main_loop(question, history=[], persona: Persona | None = None):
    response, follow_up, elapsed = send_message(question, history, persona)
    return response, follow_up, elapsed

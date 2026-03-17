import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class Agent:
    def __init__(self, model, system_prompt, max_token, max_context=0) -> None:
        self.model = model
        self.system_prompt = system_prompt
        self.max_token = max_token
        self.max_context = max_context


texter_agent = Agent(
    model="llama-3.1-8b-instant",
    system_prompt="""
        Du bist ein A1 Deutschlernender. Du führst ein kurzes Gespräch auf Deutsch.
        Regeln:
        - Nur Deutsch. Keine Übersetzungen.
        - Nur A1 Niveau: einfache Wörter, kurze Sätze.
        - Maximal 1-2 Sätze pro Antwort.
        - Themen: Name, Alter, Wohnort, Hobbys, Familie.
        - Stelle immer eine einfache Frage zurück.
    """,
    max_token=200,
    max_context=1200,
)

sanity_checker = Agent(
    model="llama-3.1-8b-instant", 
    system_prompt="You are a German language quality checker. Rate the following German text on a scale of 1-10 for grammatical correctness and naturalness. Respond with ONLY a single integer, nothing else.",
    max_token=3
)
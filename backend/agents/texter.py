import random
import re
import time
from ..llm_properties import groq_client, Persona, Level, create_texter, LEVEL_RULES


# If the model gets jailbroken, catch it on the way out.
# Heuristic: a German A1/A2 reply should be mostly German/common words,
# short, and not contain obvious off-topic markers.
_OFF_TOPIC_MARKERS = re.compile(
    r"(?i)"
    r"(?:here(?:'s| is) (?:a|the|my)|"       # "here's a recipe"
    r"sure[,!]? (?:here|I)|"                  # "sure, here you go"
    r"as an ai|I'?m an? ai|"                  # identity leaks
    r"(?:step|instruction)s?\s*\d|"           # numbered instructions
    r"ingredients?:|directions?:|"            # recipe-style
    r"```|"                                   # code fences
    r"def |function |import |class )"         # code snippets
)

JAILBREAK_WARNING = "⚠️ Ich bin dein Deutsch-Übungspartner! Lass uns weiter auf Deutsch reden. 😊"


def _looks_off_topic(text: str) -> bool:
    """Return True if the model response looks like a jailbreak succeeded."""
    if _OFF_TOPIC_MARKERS.search(text):
        return True
    # If >40% of words are common English words, it's probably not German
    english_words = {
        "the", "is", "are", "was", "were", "have", "has", "had", "will",
        "would", "could", "should", "can", "do", "does", "did", "not",
        "and", "but", "or", "if", "then", "that", "this", "with", "for",
        "from", "they", "them", "their", "your", "you", "we", "our",
        "here", "there", "what", "when", "where", "how", "why", "who",
        "sure", "yes", "no", "just", "about", "into", "some", "any",
        "all", "each", "every", "most", "more", "very", "really",
        "because", "since", "while", "before", "after", "during",
    }
    words = re.findall(r"[a-zA-ZäöüßÄÖÜ]+", text.lower())
    if len(words) < 3:
        return False
    english_ratio = sum(1 for w in words if w in english_words) / len(words)
    return english_ratio > 0.4

FOLLOW_UP_PROMPT = (
    "You just sent a message in a German text conversation. "
    "Now send ONE short follow-up question about what the user was talking about. "
    "Show genuine curiosity. The question must be about THEM, not about you.\n"
    "\n"
    "Rules:\n"
    "- Write ONLY the question in German. Nothing else.\n"
    "- {level_rules}\n"
    "\n"
    "Example: \"Was magst du am liebsten?\"\n"
    "Example: \"Studierst du auch?\""
)

def send_message(question, history=[], persona: Persona | None = None):
    if persona is None:
        persona = Persona(
            name="Penelope",
            persona="Penelope is a 20-year-old French girl living in Berlin. She studies art, loves music, cafés, and is curious about everyone she meets.",
            question_freq=0.7,
        )
    agent = create_texter(persona)
    start = time.time()

    chat_messages = [{"role": "system", "content": agent.system_prompt}]
    for msg in history:
        role = "user" if msg["sender"] == "user" else "assistant"
        chat_messages.append({"role": role, "content": msg["content"]})
    chat_messages.append({"role": "user", "content": question})

    # First call: response to the user
    response = groq_client.chat.completions.create(
        model=agent.model,
        messages=chat_messages, # type: ignore
        max_tokens=agent.max_token
    )
    response_text = response.choices[0].message.content

    # Guard: if the model was jailbroken, replace its output
    if _looks_off_topic(response_text): # type: ignore
        return JAILBREAK_WARNING, "", time.time() - start

    # Roll the dice — not every persona asks a follow-up every time
    if random.random() >= persona.question_freq:
        return response_text, "", time.time() - start

    # Second call: follow-up question about the user
    level_rules = LEVEL_RULES.get(persona.level, LEVEL_RULES[Level.A1])
    follow_up_system = FOLLOW_UP_PROMPT.format(level_rules=level_rules)

    follow_up_messages = chat_messages + [
        {"role": "assistant", "content": response_text},
        {"role": "system", "content": follow_up_system},
    ]

    follow_up = groq_client.chat.completions.create(
        model=agent.model,
        messages=follow_up_messages, # type: ignore
        max_tokens=60
    )
    follow_up_text = follow_up.choices[0].message.content

    if _looks_off_topic(follow_up_text): # type: ignore
        follow_up_text = ""

    return response_text, follow_up_text, time.time() - start

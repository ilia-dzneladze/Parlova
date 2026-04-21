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

CONCLUSION_CHECK_PROMPT = (
    "You are reviewing a German text conversation between two friends. "
    "Has the conversation reached a natural stopping point? "
    "A natural stopping point means: they said goodbye, the topic fizzled out, "
    "or the exchange feels complete.\n"
    "\n"
    "Reply with ONLY one word: YES or NO."
)

GOODBYE_PROMPT = (
    "You are {name}. You've been texting in German with a friend and it's time to go. "
    "Send a natural, casual goodbye message in German — like you actually have somewhere to be. "
    "Mention something you need to do (class, errands, meeting a friend, etc.).\n"
    "\n"
    "Rules:\n"
    "- Write ONLY the goodbye message in German. Nothing else.\n"
    "- {level_rules}\n"
    "- Keep it warm and casual. You're friends.\n"
    "\n"
    "Example: \"Okay, ich muss jetzt los! Wir schreiben später, ja? 😊\"\n"
    "Example: \"Hey, ich muss zum Unterricht. Bis bald! ✌️\""
)

_WRAP_UP_MIN = 10   # earliest we start checking
_WRAP_UP_FORCE = 20  # always wrap up at this count

_GOODBYE_PATTERNS = re.compile(
    r"(?i)\b(tschüss|tschuss|auf wiedersehen|bis bald|bis später|bis dann|"
    r"bis morgen|bis nächste|ciao|mach.s gut|viel spaß|viel spass|schönen tag)\b"
)


def _should_check_conclusion(message_count: int) -> bool:
    """Between 10-19 messages: random chance that increases with count. At 20+: always."""
    if message_count >= _WRAP_UP_FORCE:
        return True
    if message_count >= _WRAP_UP_MIN:
        # Linear ramp: 10% at msg 10 → 90% at msg 19
        chance = 0.1 + 0.8 * (message_count - _WRAP_UP_MIN) / (_WRAP_UP_FORCE - _WRAP_UP_MIN - 1)
        return random.random() < chance
    return False


def _check_conclusion(chat_messages: list[dict], model: str) -> bool:
    """Ask the LLM whether the conversation has reached a natural end."""
    check_messages = chat_messages + [
        {"role": "system", "content": CONCLUSION_CHECK_PROMPT},
    ]
    result = groq_client.chat.completions.create(
        model=model,
        messages=check_messages,  # type: ignore
        max_tokens=5,
    )
    answer = (result.choices[0].message.content or "").strip().upper()
    return answer.startswith("YES")


def _generate_goodbye(chat_messages: list[dict], persona: Persona, model: str) -> str:
    """Generate a casual goodbye message in-character."""
    level_rules = LEVEL_RULES.get(persona.level, LEVEL_RULES[Level.A1])
    goodbye_system = GOODBYE_PROMPT.format(name=persona.name, level_rules=level_rules)
    goodbye_messages = chat_messages + [
        {"role": "system", "content": goodbye_system},
    ]
    result = groq_client.chat.completions.create(
        model=model,
        messages=goodbye_messages,  # type: ignore
        max_tokens=80,
    )
    return result.choices[0].message.content or ""


def send_message(question, history=[], persona: Persona | None = None, message_count: int = 0, quest=None):
    if persona is None:
        persona = Persona(
            name="Penelope",
            persona="Penelope is a 20-year-old French girl living in Berlin. She studies art, loves music, cafés, and is curious about everyone she meets.",
            question_freq=0.7,
        )
    agent = create_texter(persona, quest=quest)
    start = time.time()

    chat_messages = [{"role": "system", "content": agent.system_prompt}]
    for msg in history:
        role = "user" if msg["sender"] == "user" else "assistant"
        chat_messages.append({"role": role, "content": msg["content"]})
    chat_messages.append({"role": "user", "content": question})

    # Trim history if it exceeds max_context (word-count approximation)
    if agent.max_context > 0:
        system_msg = chat_messages[0]
        conversation = chat_messages[1:]
        min_keep = min(8, len(conversation))  # latest 4 turns = 8 messages
        while (len(conversation) > min_keep and
               sum(len(m["content"].split()) for m in [system_msg] + conversation) > agent.max_context):
            conversation.pop(0)
        chat_messages = [system_msg] + conversation

    # Main reply
    response = groq_client.chat.completions.create(
        model=agent.model,
        messages=chat_messages, # type: ignore
        max_tokens=agent.max_token
    )
    response_text = response.choices[0].message.content

    # Guard: if the model was jailbroken, replace its output
    if _looks_off_topic(response_text): # type: ignore
        return JAILBREAK_WARNING, "", False, time.time() - start

    # Check if it's time to wrap up
    full_messages = chat_messages + [{"role": "assistant", "content": response_text}]
    user_goodbye = bool(_GOODBYE_PATTERNS.search(question))
    early_goodbye = bool(_GOODBYE_PATTERNS.search(response_text))  # type: ignore
    if user_goodbye or early_goodbye or _should_check_conclusion(message_count):
        force = message_count >= _WRAP_UP_FORCE
        # User saying goodbye is a hard signal — skip the LLM check
        concluded = user_goodbye or _check_conclusion(full_messages, agent.model)
        if concluded or force:
            # Don't append a second goodbye if the response already contains one
            goodbye = "" if early_goodbye else _generate_goodbye(full_messages, persona, agent.model)
            if goodbye and _looks_off_topic(goodbye):  # type: ignore
                goodbye = "Okay, ich muss jetzt los! Bis bald! 😊"
            return response_text, goodbye, True, time.time() - start

    return response_text, "", False, time.time() - start

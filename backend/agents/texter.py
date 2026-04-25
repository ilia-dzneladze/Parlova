import random
import re
import time
from ..llm_properties import groq_client, Persona, create_texter
from ..prompts import CONCLUSION_CHECK_PROMPT, GOODBYE_PROMPT


_MAX_BUBBLES = 4


def _split_bubbles(text: str) -> list[str]:
    parts = [p.strip() for p in text.split("|||")]
    bubbles = [p for p in parts if p]
    if len(bubbles) <= 1 and bubbles:
        sentences = re.split(r"(?<=[.!?…])\s+", bubbles[0])
        sentences = [s.strip() for s in sentences if s.strip()]
        if len(sentences) > 1:
            bubbles = sentences
    return bubbles[:_MAX_BUBBLES]


_OFF_TOPIC_MARKERS = re.compile(
    r"(?i)"
    r"(as an ai|I'?m an? ai language model|I cannot (?:help|assist|do)|"
    r"```|"
    r"^\s*(?:def |function |import |class |#include|<\?php))"
)

IN_CHARACTER_REDIRECT = "Haha, nee, dafür bin ich nicht da.|||Lass uns lieber weiter quatschen — was machst du gerade so?"


def _looks_off_topic(text: str) -> bool:
    return bool(_OFF_TOPIC_MARKERS.search(text))


_WRAP_UP_MIN = 10
_WRAP_UP_FORCE = 20

_GOODBYE_PATTERNS = re.compile(
    r"(?i)\b(tschüss|tschuss|auf wiedersehen|bis bald|bis später|bis dann|"
    r"bis morgen|bis nächste|ciao|mach.s gut|viel spaß|viel spass|schönen tag)\b"
)


def _should_check_conclusion(message_count: int) -> bool:
    if message_count >= _WRAP_UP_FORCE:
        return True
    if message_count >= _WRAP_UP_MIN:
        chance = 0.1 + 0.8 * (message_count - _WRAP_UP_MIN) / (_WRAP_UP_FORCE - _WRAP_UP_MIN - 1)
        return random.random() < chance
    return False


def _check_conclusion(chat_messages: list[dict], model: str) -> bool:
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
    goodbye_system = GOODBYE_PROMPT.format(name=persona.name)
    goodbye_messages = chat_messages + [
        {"role": "system", "content": goodbye_system},
    ]
    result = groq_client.chat.completions.create(
        model=model,
        messages=goodbye_messages,  # type: ignore
        max_tokens=80,
    )
    return result.choices[0].message.content or ""


def send_message(question, history=[], persona: Persona | None = None, message_count: int = 0, model: str | None = None):
    if persona is None:
        persona = Persona(
            name="Penelope",
            persona="Penelope is a 20-year-old French girl living in Berlin. She studies art, loves music, cafés, and is curious about everyone she meets.",
            question_freq=0.7,
        )
    agent = create_texter(persona, model=model)
    start = time.time()

    chat_messages = [{"role": "system", "content": agent.system_prompt}]
    for msg in history:
        role = "user" if msg["sender"] == "user" else "assistant"
        chat_messages.append({"role": role, "content": msg["content"]})
    chat_messages.append({"role": "user", "content": question})

    if agent.max_context > 0:
        system_msg = chat_messages[0]
        conversation = chat_messages[1:]
        min_keep = min(8, len(conversation))
        while (len(conversation) > min_keep and
               sum(len(m["content"].split()) for m in [system_msg] + conversation) > agent.max_context):
            conversation.pop(0)
        chat_messages = [system_msg] + conversation

    response = groq_client.chat.completions.create(
        model=agent.model,
        messages=chat_messages,  # type: ignore
        max_tokens=agent.max_token
    )
    response_text = response.choices[0].message.content

    if _looks_off_topic(response_text):  # type: ignore
        return _split_bubbles(IN_CHARACTER_REDIRECT), "", False, time.time() - start

    bubbles = _split_bubbles(response_text or "")
    if not bubbles:
        bubbles = [response_text or ""]

    full_messages = chat_messages + [{"role": "assistant", "content": response_text}]
    user_goodbye = bool(_GOODBYE_PATTERNS.search(question))
    early_goodbye = bool(_GOODBYE_PATTERNS.search(response_text))  # type: ignore
    if user_goodbye or early_goodbye or _should_check_conclusion(message_count):
        force = message_count >= _WRAP_UP_FORCE
        concluded = user_goodbye or _check_conclusion(full_messages, agent.model)
        if concluded or force:
            goodbye = "" if early_goodbye else _generate_goodbye(full_messages, persona, agent.model)
            if goodbye and _looks_off_topic(goodbye):  # type: ignore
                goodbye = "Okay, ich muss jetzt los! Bis bald! 😊"
            return bubbles, goodbye, True, time.time() - start

    return bubbles, "", False, time.time() - start

import time
from ..llm_properties import groq_client, Persona, Level, create_texter, LEVEL_RULES

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

    return response_text, follow_up_text, time.time() - start

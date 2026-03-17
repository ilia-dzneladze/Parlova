import time
from ..llm_properties import groq_client, texter_agent

def send_message(question, history=[]):
    start = time.time()
    
    chat_messages = [{"role": "system", "content": texter_agent.system_prompt}]
    for msg in history:
        role = "user" if msg["sender"] == "user" else "assistant"
        chat_messages.append({"role": role, "content": msg["content"]})
    chat_messages.append({"role": "user", "content": question})

    response = groq_client.chat.completions.create(
        model=texter_agent.model,
        messages=chat_messages, # type: ignore
        max_tokens=texter_agent.max_token
    )
    response_text = response.choices[0].message.content
    return response_text, time.time() - start
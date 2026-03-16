import time
from ..llm_properties import groq_client, texter_agent

def send_message(question):
    start = time.time()
    completion = groq_client.chat.completions.create(
        model=texter_agent.model,
        messages=[
            {"role": "system", "content": texter_agent.system_prompt},
            {"role": "user", "content": question},
        ],
        max_tokens=texter_agent.max_token,
    )
    response_text = completion.choices[0].message.content or ""
    return response_text, time.time() - start

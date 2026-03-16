from .agents.texter import send_message

def main_loop(question):
    return send_message(question)

if __name__ == "__main__":
    question = "Hallo! Ich bin Ilia. Wie heißt du?"
    message_count = 0

    while send_message(question) == 1 and message_count < 5:
        question = input()
        message_count += 1

    if message_count == 5:
        print("Vielen Dank!")
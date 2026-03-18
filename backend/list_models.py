import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print("Available Models:")
for m in client.models.list():
    # Model object in newer SDK might have different fields
    print(f"Name: {m.name}")

import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print("Testing Gemini Flash...")
try:
    response = client.models.generate_content(model="gemini-1.5-flash", contents="Hi")
    print(f"Success with 'gemini-1.5-flash': {response.text}")
except Exception as e:
    print(f"Failed with 'gemini-1.5-flash': {e}")

print("\nTesting Embedding...")
try:
    # Use the name exactly as it appeared in list_models (with models/)
    response = client.models.embed_content(model="models/gemini-embedding-001", contents="Hello world")
    print(f"Success with 'models/gemini-embedding-001'")
except Exception as e:
    print(f"Failed with 'models/gemini-embedding-001': {e}")

try:
    # Try without models/
    response = client.models.embed_content(model="gemini-embedding-001", contents="Hello world")
    print(f"Success with 'gemini-embedding-001'")
except Exception as e:
    print(f"Failed with 'gemini-embedding-001': {e}")

import json
import hashlib
import asyncio
import redis.asyncio as redis
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from google import genai
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.core.config import settings
from app.core.database import Chunk

class RAGService:
    def __init__(self):
        # The prompt asked for gemini client with api_version="v1"
        # google-genai is used here. For new sdk, client = genai.Client(api_key=...)
        if settings.GEMINI_API_KEY:
            self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        else:
            self.gemini_client = None

        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=settings.GEMINI_API_KEY
        )

        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True
        )
        self.cache_ttl = 3600

        self.model_fallback = ["models/gemini-2.0-flash", "models/gemini-flash-latest", "models/gemini-1.5-flash"]

    def _get_cache_key(self, prompt: str) -> str:
        return hashlib.md5(prompt.encode('utf-8')).hexdigest()

    async def get_cache(self, key: str) -> Optional[str]:
        try:
            return await self.redis_client.get(key)
        except Exception as e:
            print(f"Redis get error: {e}")
            return None

    async def set_cache(self, key: str, value: str):
        try:
            await self.redis_client.setex(key, self.cache_ttl, value)
        except Exception as e:
            print(f"Redis set error: {e}")

    def get_embedding(self, text: str) -> List[float]:
        # Uses langchain-google-genai's wrapper
        return self.embeddings.embed_query(text)

    async def _generate_with_retry(self, prompt: str) -> str:
        for model in self.model_fallback:
            for attempt in range(3):
                try:
                    # using google-genai
                    # response = self.gemini_client.models.generate_content(
                    #     model=model, contents=prompt
                    # )
                    # return response.text
                    
                    # Alternatively, if we just want a simple wrapper
                    return await asyncio.to_thread(self._sync_generate, model, prompt)
                except Exception as e:
                    if "429" in str(e):
                        await asyncio.sleep(2 ** attempt)
                    else:
                        print(f"Error with model {model}: {e}")
                        break
        print("ALL FALLBACK MODELS FAILED.")
        raise Exception("All fallback models failed or retries exhausted.")

    def _sync_generate(self, model: str, prompt: str) -> str:
        if not self.gemini_client:
            return "Error: GEMINI_API_KEY not configured."
        response = self.gemini_client.models.generate_content(
            model=model, contents=prompt
        )
        return response.text

    async def expand_query(self, query: str) -> List[str]:
        prompt = f"""You are an expert search assistant. Generate 3 alternative formulations of the following user query to improve document retrieval. Only output the 3 alternative queries, separated by newlines, with no additional text or numbering.
Original query: {query}"""
        try:
            response = await self._generate_with_retry(prompt)
            return [q.strip() for q in response.split('\n') if q.strip()]
        except Exception as e:
            print(f"Query expansion failed: {e}")
            return [query]

    def search_vectors(self, db: Session, query_embedding: List[float], limit: int = 5) -> List[Chunk]:
        # Using pgvector cosine distance: embedding.cosine_distance(query_embedding)
        # Order by ascending distance (smallest distance = most similar)
        chunks = db.query(Chunk).order_by(
            Chunk.embedding.cosine_distance(query_embedding)
        ).limit(limit).all()
        return chunks

    async def generate_answer(self, db: Session, query: str, history: List[Dict[str, str]]) -> str:
        cache_key = self._get_cache_key(query + json.dumps(history))
        cached_answer = await self.get_cache(cache_key)
        if cached_answer:
            return cached_answer

        # 1. Expand query (optional, can just use the original to get embeddings, or embed all and search)
        # Here we just use the original query embedding for vector search for simplicity and speed.
        query_embedding = await asyncio.to_thread(self.get_embedding, query)

        # 2. Search vectors
        relevant_chunks = await asyncio.to_thread(self.search_vectors, db, query_embedding)

        # 3. Formulate history string
        history_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history])

        context_str = "\n\n".join([chunk.content for chunk in relevant_chunks])

        # 4. Prompt
        prompt = f"""You are a helpful AI assistant inside DocuMind AI. Use the following context documents to answer the user's question. If you don't know the answer, just say you don't know. Do not make up information.
        
Context Documents:
{context_str}

Chat History:
{history_str}

User Question: {query}

Answer:"""

        # 5. Generate and Cache
        answer = await self._generate_with_retry(prompt)
        await self.set_cache(cache_key, answer)

        return answer

rag_service = RAGService()

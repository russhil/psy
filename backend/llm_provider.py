"""
Configurable LLM provider abstraction for PsyShot CRM.
Uses Gemma-3-27b-it via Google AI Studio for NLP tasks.
Mirrors the parchi project pattern.
"""

import asyncio
import os
from abc import ABC, abstractmethod

from google import genai
from google.genai import types


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    def generate(self, prompt: str, max_tokens: int = 1000) -> str:
        ...

    async def generate_async(self, prompt: str, max_tokens: int = 1000) -> str:
        return await asyncio.to_thread(self.generate, prompt, max_tokens)


class GemmaProvider(LLMProvider):
    """Google AI Studio provider using Gemma-3-27b-it.
    No JSON mode — all responses are plain text with structured markers.
    """

    def __init__(self, api_key: str, model_name: str = "gemma-3-27b-it"):
        self.client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
        self.model_name = model_name

    def generate(self, prompt: str, max_tokens: int = 1000) -> str:
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=max_tokens,
                ),
            )
            return response.text
        except Exception as e:
            return f"AI error: {str(e)}"

    async def generate_async(self, prompt: str, max_tokens: int = 1000) -> str:
        try:
            return await asyncio.to_thread(self.generate, prompt, max_tokens)
        except Exception as e:
            return f"AI error: {str(e)}"


_llm: LLMProvider | None = None


def init_llm(provider: LLMProvider | None = None) -> None:
    """Initialize the global LLM provider. Call once at startup."""
    global _llm
    if provider is not None:
        _llm = provider
        return
    api_key = os.getenv("GOOGLE_API_KEY", "")
    if api_key:
        _llm = GemmaProvider(api_key)


def get_llm() -> LLMProvider | None:
    """Return the configured LLM provider, or None if not configured."""
    return _llm

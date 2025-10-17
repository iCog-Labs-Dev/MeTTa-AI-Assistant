"""
LLM-based prompt rewriter implementation using Google's Gemini API.
"""

import os
import logging
from typing import Optional
import google.generativeai as genai
from dotenv import load_dotenv
from .rewriter import PromptRewriter

logger = logging.getLogger(__name__)

load_dotenv()

try:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not found in environment variables")
    else:
        genai.configure(api_key=api_key)
except Exception as e:
    logger.error(f"Failed to configure Gemini: {e}")

class LLMPromptRewriter(PromptRewriter):
    """
    A PromptRewriter that uses an LLM to rewrite prompts.
    Preserves code blocks while allowing the LLM to modify the natural language parts.
    """
    
    def __init__(
        self,
        model: str = "gemini-pro",
        temperature: float = 0.3,
        max_tokens: int = 1000,
        **kwargs
    ):
        """
        Initialize the LLM rewriter.
        
        Args:
            model: Gemini model name
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum output tokens
        
        Raises:
            ValueError: If API key is not set or parameters are invalid
        """
        super().__init__(**kwargs)
        
        
        if not isinstance(temperature, (int, float)) or not 0.0 <= temperature <= 1.0:
            raise ValueError("Temperature must be between 0.0 and 1.0")
        if not isinstance(max_tokens, int) or max_tokens <= 0:
            raise ValueError("max_tokens must be a positive integer")
            
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
            
        self.model = genai.GenerativeModel(model)
        self.temperature = temperature
        self.max_tokens = max_tokens
    
        
    async def _apply_rewrite_rules(self, text: str, **kwargs) -> str:
        """
        Use an LLM to rewrite the prompt while preserving code blocks.
        """
        system_prompt = """You are a helpful assistant that rewrites prompts to be more clear, specific, and effective.
        - Preserve all code blocks exactly as they are
        - Improve the natural language parts to be more precise and actionable
        - Maintain the original intent while making the prompt more effective
        - If the prompt is already well-written, return it as-is"""
        
        try:
            prompt = f"""{system_prompt}
            
            Please rewrite the following prompt while preserving all code blocks exactly as they are:
            
            {text}"""
            
            import asyncio
            
            def _generate_content():
                return self.model.generate_content(
                    prompt,
                    generation_config={
                        'temperature': self.temperature,
                        'max_output_tokens': self.max_tokens,
                    }
                )
            
            response = await asyncio.to_thread(_generate_content)
            
            rewritten = response.text.strip()
            return rewritten
            
        except Exception as e:
            logger.error(f"LLM rewrite failed: {e}")
            return text

    @classmethod
    async def create(
        cls,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> 'LLMPromptRewriter':
        """
        Factory method to create an LLMPromptRewriter instance with environment variable fallbacks.
        """
        return cls(
            model=model or os.getenv("GEMINI_MODEL", "gemini-pro"),
            temperature=float(temperature or os.getenv("GEMINI_TEMPERATURE", 0.3)),
            max_tokens=int(max_tokens or os.getenv("GEMINI_MAX_TOKENS", 1000)),
            **kwargs
        )

"""
LLM-based prompt rewriter implementation using Google's Gemini API.
"""

import os
import asyncio
from typing import Optional
from loguru import logger
import google.generativeai as genai
from dotenv import load_dotenv
from app.core.prompt_rewriter.rewriter import PromptRewriter

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
    The LLM handles code detection, wrapping, and preservation intelligently.
    """
    
    def __init__(
        self,
        model: str = "gemini-1.5-flash",
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
    
    async def rewrite(self, prompt: str, **kwargs) -> str:
        """
        Rewrite method that uses LLM to detect and wrap MeTTa code before rewriting.
        
        Args:
            prompt: The input prompt to rewrite
            **kwargs: Additional arguments for the rewrite operation
            
        Returns:
            The rewritten prompt with detected MeTTa code properly wrapped
        """
        prompt = await self.detect_and_wrap_metta_code(prompt)
        
        return await super().rewrite(prompt, **kwargs)
    
    async def detect_and_wrap_metta_code(self, text: str) -> str:
        """
        Detect MeTTa code in text and wrap it with proper markdown code blocks.
        
        Args:
            text: Input text that may contain MeTTa code
            
        Returns:
            Text with MeTTa code properly wrapped in ```metta blocks
        """
        if not text.strip():
            return text
            
        try:
            wrapped_text = await self._detect_with_llm(text)
            return wrapped_text
        except Exception as e:
            logger.error(f"LLM code detection failed: {e}")
            return text
    
    async def _detect_with_llm(self, text: str) -> str:
        """
        Use LLM to detect and wrap MeTTa code.
        """
        detection_prompt = self._build_detection_prompt(text)
        
        def _generate_content():
            return self.model.generate_content(
                detection_prompt,
                generation_config={
                    'temperature': 0.1,
                    'max_output_tokens': self.max_tokens,
                }
            )
        
        response = await asyncio.to_thread(_generate_content)
        return response.text.strip()
    
    def _build_detection_prompt(self, text: str) -> str:
        """
        Build the prompt for MeTTa code detection.
        """
        return f"""You are an expert in MeTTa programming language. Your task is to identify MeTTa code within natural language text and wrap it with proper markdown code blocks.

**MeTTa Language Characteristics:**
- Uses S-expression syntax with parentheses: (function arg1 arg2)
- Variables start with $: $x, $var, $result
- Common functions: match, unify, if, case, =, +, -, *, /
- Equality definitions: (= (func args) body)
- Comments start with semicolon: ; this is a comment
- Boolean literals: True, False
- List operations: (car $list), (cdr $list)
- Pattern matching: (match $x ((pattern) result))
- Execution expressions: (! (expr))

**Your Task:**
1. Identify any MeTTa code expressions in the text below
2. Wrap each MeTTa code expression with ```metta and ``` 
3. Keep all natural language text unchanged
4. If no MeTTa code is found, return the text unchanged
5. Be conservative - only wrap text that is clearly MeTTa code
6. Variables like $x, $var should be wrapped when they are clearly MeTTa variables
7. S-expressions like (match ...) should be wrapped

**Examples:**

Input: "How does (match $x ((plus $a $b) $result)) work?"
Output: "How does ```metta\n(match $x ((plus $a $b) $result))\n``` work?"

Input: "Define factorial: (= (factorial 0) 1) and (= (factorial $n) (* $n (factorial (- $n 1))))"
Output: "Define factorial: ```metta\n(= (factorial 0) 1)\n``` and ```metta\n(= (factorial $n) (* $n (factorial (- $n 1))))\n```"

Input: "I need to match these socks with the correct pair."
Output: "I need to match these socks with the correct pair."

Input: "What does $x represent in this context?"
Output: "What does ```metta\n$x\n``` represent in this context?"

Input: "The expression (+ 1 2) should equal 3"
Output: "The expression ```metta\n(+ 1 2)\n``` should equal 3"

**Text to Process:**
{text}

**Instructions:**
- Return ONLY the processed text with MeTTa code wrapped
- Do NOT add explanations or comments
- Preserve all spacing and formatting
- Be precise - only wrap actual MeTTa expressions"""
    
        
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
            
            if not response.text:
                logger.warning(f"LLM response blocked or empty. Returning original text.")
                return text
            
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
            model=model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            temperature=float(temperature or os.getenv("GEMINI_TEMPERATURE", 0.3)),
            max_tokens=int(max_tokens or os.getenv("GEMINI_MAX_TOKENS", 1000)),
            **kwargs
        )

import logging
from typing import Optional
from .code_preserver import CodePreserver


logger = logging.getLogger(__name__)

class PromptRewriter:
    """
    Handles rewriting of prompts while preserving code blocks.
    """
    
    def __init__(self, 
                 preserve_code: bool = True,
                 max_retries: int = 3):
        """
        Initialize the PromptRewriter.
        
        Args:
            preserve_code: Whether to preserve code blocks during rewriting
            max_retries: Maximum number of retries for rewriting
        """
        self.preserve_code = preserve_code
        self.max_retries = max_retries
        self.code_preserver = CodePreserver() if preserve_code else None
        
    async def rewrite(self, prompt: str, **kwargs) -> str:
        """
        Rewrite the given prompt while preserving code blocks.

        Args:
            prompt: The input prompt to rewrite
            **kwargs: Additional arguments for the rewrite operation
            
        Returns:
            The rewritten prompt with preserved code blocks
            
        Raises:
            ValueError: If prompt is None or not a string
        """
        if prompt is None:
            raise ValueError("Prompt cannot be None")
        if not isinstance(prompt, str):
            raise ValueError("Prompt must be a string")
        if not prompt.strip():
            return prompt
            
        if not self.preserve_code or not self._contains_code(prompt):
            return await self._apply_rewrite_rules(prompt, **kwargs)
            
        processed_prompt, code_blocks = self.code_preserver.extract_code(prompt)
        
        rewritten = await self._apply_rewrite_rules_with_retry(
            processed_prompt, 
            **kwargs
        )
        
        if code_blocks:
            rewritten = self.code_preserver.restore_code(rewritten, code_blocks)
            
        return rewritten
        
    async def _apply_rewrite_rules_with_retry(
        self, 
        text: str, 
        **kwargs
    ) -> str:
        """
        Apply rewrite rules with retry mechanism.
        """
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                return await self._apply_rewrite_rules(text, **kwargs)
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Rewrite attempt {attempt + 1} failed: {e}"
                )
                if attempt == self.max_retries - 1:
                    logger.error(
                        f"All {self.max_retries} rewrite attempts failed. "
                        f"Returning original text. Last error: {last_error}"
                    )
                    return text
                
    async def _apply_rewrite_rules(self, text: str, **kwargs) -> str:
        """
        Apply the actual rewriting logic to the text.
        This is a basic implementation that is overridden by subclasses.
        
        Args:
            text: The text to rewrite
            **kwargs: Additional arguments for the rewrite operation
            
        Returns:
            The rewritten text (same as input in base implementation)
        """
        return text
        
    def _contains_code(self, text: str) -> bool:
        """
        Check if the text contains code blocks or MeTTa code.
        """
        if not self.preserve_code:
            return False
            
        if '```' in text:
            return True
            
        return self.code_preserver.is_metta_code(text)
        
    @classmethod
    async def create(
        cls, 
        preserve_code: bool = True,
        max_retries: int = 3,
        **kwargs
    ) -> 'PromptRewriter':
        """
        Factory method to create a PromptRewriter instance.
        """
        return cls(preserve_code=preserve_code, max_retries=max_retries)

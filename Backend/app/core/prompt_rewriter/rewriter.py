import logging
from typing import Optional


logger = logging.getLogger(__name__)

class PromptRewriter:
    """
    Handles rewriting of prompts.
    """
    
    def __init__(self, max_retries: int = 3):
        """
        Initialize the PromptRewriter.
        
        Args:
            max_retries: Maximum number of retries for rewriting
        """
        self.max_retries = max_retries
        
    async def rewrite(self, prompt: str, **kwargs) -> str:
        """
        Rewrite the given prompt.

        Args:
            prompt: The input prompt to rewrite
            **kwargs: Additional arguments for the rewrite operation
            
        Returns:
            The rewritten prompt
            
        Raises:
            ValueError: If prompt is None or not a string
        """
        if prompt is None:
            raise ValueError("Prompt cannot be None")
        if not isinstance(prompt, str):
            raise ValueError("Prompt must be a string")
        if not prompt.strip():
            return prompt
            
        return await self._apply_rewrite_rules_with_retry(prompt, **kwargs)
        
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
        
    @classmethod
    async def create(
        cls, 
        max_retries: int = 3,
        **kwargs
    ) -> 'PromptRewriter':
        """
        Factory method to create a PromptRewriter instance.
        """
        return cls(max_retries=max_retries)

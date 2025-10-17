import re
from typing import Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class CodePreserver:
    """
    Handles extraction and restoration of code blocks in prompts.
    Preserves MeTTa code blocks during text processing.
    """
    
    def __init__(self):
        self.code_block_pattern = re.compile(
            r'```(?:(\w+)\n)?(.*?)```', 
            re.DOTALL
        )
        self.placeholder_prefix = "__META_CODE_BLOCK_"
        self.placeholder_suffix = "__"
        
    def extract_code(self, text: str) -> Tuple[str, Dict[str, str]]:
        """
        Extract code blocks from text and replace them with placeholders.
        
        Args:
            text: Input text potentially containing code blocks
            
        Returns:
            Tuple of (text with placeholders, mapping of placeholders to code blocks)
        """
        code_blocks = {}
        
        def replace_code(match: re.Match) -> str:
            lang = match.group(1)
            code = match.group(2).strip()
            placeholder = f"{self.placeholder_prefix}{len(code_blocks)}{self.placeholder_suffix}"
            code_blocks[placeholder] = {'code': code, 'lang': lang}
            return placeholder
            
        processed_text = self.code_block_pattern.sub(replace_code, text)
        
        return processed_text, code_blocks
    
    def restore_code(self, text: str, code_blocks: Dict[str, str]) -> str:
        """
        Restore code blocks from placeholders in the text.
        
        Args:
            text: Text containing placeholders
            code_blocks: Mapping of placeholders to code blocks
            
        Returns:
            Text with placeholders replaced by original code blocks
        """
        if not code_blocks:
            return text
            

        sorted_placeholders = sorted(
            code_blocks.keys(), 
            key=len, 
            reverse=True
        )
        
        for placeholder in sorted_placeholders:
            if placeholder in text:
                code_info = code_blocks[placeholder]
                if isinstance(code_info, str):
                    code = code_info
                    lang = 'metta'
                else:
                    code = code_info['code']
                    lang = code_info.get('lang', 'metta')
                
                restored_code = f'```{lang}\n{code}\n```'
                text = text.replace(placeholder, restored_code)
                
        return text
    
    def is_metta_code(self, text: str) -> bool:
        """
        Check if the given text is likely MeTTa code.
        """
        metta_keywords = [
            'match', 'and', 'unify', 'if', 'case', 'Reset', 'Implies',
            'get-type', 'quote', 'get-metatype'
        ]
        
        metta_patterns = [
            r'\(\s*(?:match|unify|if|case|get-type|Implies)\b',
            r'\b(?:->|=>|:)\s*[\w-]+',
            r'\$[a-zA-Z]',
            r'\b(?:True|False|true|false)\b',
        ]
        

        for kw in metta_keywords:
            if re.search(rf'\b{re.escape(kw)}\b', text):
                return True
            
        if any(re.search(pattern, text) for pattern in metta_patterns):
            return True
            
        return False

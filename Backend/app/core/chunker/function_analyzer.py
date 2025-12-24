"""
Function analysis module for MeTTa code.
Extracts function calls and definitions to support dependency tracking.
"""

from typing import List, Set
from app.core.chunker import metta_ast_parser
from loguru import logger

# Built-in MeTTa functions and operations
BUILTIN_FUNCTIONS = {
    "match", "case", "if", "let", "let*", "chain", 
    "+", "-", "*", "/", "mod", "//",
    "==", "!=", "<", ">", "<=", ">=",
    "and", "or", "not",
    "car", "cdr", "cons", "collapse", "superpose",
    "get-type", "get-metatype",
    "add-atom", "remove-atom", "get-atoms",
    "import!", "bind!", "pragma!", "assertEqual",
    "empty", "Error", "True", "False",
    "filter", "map", "foldl", "foldr", "zip", "unify",
}


def extract_function_calls(code: str) -> List[str]:
    """
    Extract all function calls from MeTTa code.
    
    Args:
        code: MeTTa source code as string
        
    Returns:
        List of function names called in the code (excluding built-ins)
    """
    try:
        nodes = metta_ast_parser.parse(code)
        function_calls = set()
        
        for node in nodes:
            _extract_calls_from_node(node, function_calls, code)
        
        custom_calls = [f for f in function_calls if not is_builtin_function(f)]
        
        return custom_calls
    except Exception as e:
        logger.warning(f"Failed to parse code for function calls: {e}")
        return []


def _extract_calls_from_node(node: metta_ast_parser.SyntaxNode, calls: Set[str], code: str) -> None:
    """
    Recursively extract function calls from a syntax node.
    
    Args:
        node: Syntax node to process
        calls: Set to accumulate function names
        code: Original source code for text extraction
    """
    if node.node_type in (metta_ast_parser.SyntaxNodeType.CallGroup, 
                          metta_ast_parser.SyntaxNodeType.ExpressionGroup):
        if node.sub_nodes:
            for sub in node.sub_nodes:
                if sub.node_type == metta_ast_parser.SyntaxNodeType.WordToken:
                    func_name = sub.parsed_text
                    if func_name and not func_name.startswith("$"): 
                        calls.add(func_name)
                    break 
    
    for sub_node in node.sub_nodes:
        _extract_calls_from_node(sub_node, calls, code)


def extract_function_definitions(code: str) -> List[str]:
    """
    Extract all function definitions from MeTTa code.
    
    Args:
        code: MeTTa source code as string
        
    Returns:
        List of function names defined in the code
    """
    try:
        nodes = metta_ast_parser.parse(code)
        definitions = set()
        
        for node in nodes:
            if node.node_type == metta_ast_parser.SyntaxNodeType.RuleGroup:
                func_name = _extract_function_name_from_rule(node, code)
                if func_name:
                    definitions.add(func_name)
        
        return list(definitions)
    except Exception as e:
        logger.warning(f"Failed to parse code for function definitions: {e}")
        return []


def _extract_function_name_from_rule(node: metta_ast_parser.SyntaxNode, code: str) -> str:
    """
    Extract function name from a rule definition node.
    
    For example, in (= (factorial $n) ...), extracts "factorial"
    
    Args:
        node: RuleGroup syntax node
        code: Original source code
        
    Returns:
        Function name or empty string
    """
    for sub_node in node.sub_nodes:
        if sub_node.node_type == metta_ast_parser.SyntaxNodeType.ExpressionGroup:
            for inner in sub_node.sub_nodes:
                if inner.node_type == metta_ast_parser.SyntaxNodeType.WordToken:
                    return inner.parsed_text
    
    return ""


def is_builtin_function(func_name: str) -> bool:
    """
    Check if a function name is a built-in MeTTa function.
    
    Args:
        func_name: Name of the function
        
    Returns:
        True if built-in, False if custom
    """
    return func_name in BUILTIN_FUNCTIONS


def get_custom_function_calls(code: str) -> List[str]:
    """
    Extract only custom (non-built-in) function calls from code.
    This is a convenience function that combines extraction and filtering.
    
    Args:
        code: MeTTa source code
        
    Returns:
        List of custom function names called
    """
    all_calls = extract_function_calls(code)
    return [f for f in all_calls if not is_builtin_function(f)]

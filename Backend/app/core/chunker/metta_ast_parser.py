from enum import Enum, auto
from typing import List, Optional, Tuple

class SyntaxNodeType(Enum):
    Comment = auto()
    VariableToken = auto()
    StringToken = auto()
    WordToken = auto()
    OpenParen = auto()
    CloseParen = auto()
    Whitespace = auto()
    LeftoverText = auto()
    ErrorGroup = auto()

    # Goal is to diversify Expression with more specific groups 
    ExpressionGroup = auto()  
    CallGroup = auto()
    RuleGroup = auto()
    TypeCheckGroup = auto()

    def is_leaf(self) -> bool:
        return self not in {SyntaxNodeType.ExpressionGroup, SyntaxNodeType.ErrorGroup}


class SyntaxNode:
    def __init__(self,
                 node_type: SyntaxNodeType,
                 src_range: range,
                 sub_nodes: Optional[List["SyntaxNode"]] = None,
                 parsed_text: Optional[str] = None,
                 message: Optional[str] = None,
                 is_complete: bool = True) -> None:
        
        self.node_type = node_type
        self.sub_nodes = sub_nodes or []
        self.parsed_text = parsed_text
        self.message = message
        self.is_complete = is_complete
        self.src_range_internal = src_range

    @property
    def src_range(self) -> Tuple[int, int]:
        return (self.src_range_internal.start, self.src_range_internal.stop)
    
    @property
    def node_type_str(self) -> str:
        return self.node_type.name

    def __str__(self) -> str:
        return f"SyntaxNode(type={self.node_type}, range={self.src_range}, text={self.parsed_text})"

    __repr__ = __str__

    @classmethod
    def new(cls, node_type: "SyntaxNodeType", src_range: range, sub_nodes: List["SyntaxNode"]) -> "SyntaxNode":
        return cls(node_type, src_range, sub_nodes=sub_nodes)

    @classmethod
    def new_token_node(cls, node_type: "SyntaxNodeType", src_range: range, text: str) -> "SyntaxNode":
        return cls(node_type, src_range, sub_nodes=[], parsed_text=text)


class CharReader:
    def __init__(self, text: str) -> None:
        self.text = text
        self.idx = 0
        self.peeked = self._next_internal()

    def last_idx(self) -> int:
        return self.idx

    def peek(self) -> Optional[Tuple[int, str]]:
        return self.peeked[0]

    def next(self) -> Optional[Tuple[int, str]]:
        # self.idx += self.peeked[1]
        self.idx += 1
        nxt = self._next_internal()
        prev = self.peeked[0]
        self.peeked = nxt
        return prev

    def _next_internal(self) -> Tuple[Optional[Tuple[int, str]], int]:
        if self.idx < len(self.text):
            c = self.text[self.idx]
            # return (self.idx, c), len(c.encode("utf-8"))
            return (self.idx, c), 1
        return None, 0


class SExprParser:
    def __init__(self, text: str) -> None:
        self.it = CharReader(text)

    def peek(self) -> Optional[Tuple[int, str]]:
        item = self.it.peek()
        return item if item else None

    def next(self) -> Optional[Tuple[int, str]]:
        item = self.it.next()
        return item if item else None

    def skip_next(self) -> None:
        self.it.next()

    def cur_idx(self) -> int:
        return self.it.last_idx()

    def parse_to_syntax_tree(self) -> Optional["SyntaxNode"]:
        while (peeked := self.peek()) is not None:
            _, c = peeked
            if c.isspace():
                self.skip_next()
                continue

            if c == "!":
                return self.parse_exec_expression()
            elif c == ";":
                return self.parse_comment()
            elif c == "$":
                return self.parse_variable()
            elif c == "(":
                return self.parse_expr()
            elif c == ")":
                self.skip_next()
                continue
            elif c == '"':
                return self.parse_string()
            else:
                return self.parse_word()
        return None

    def parse_exec_expression(self) -> "SyntaxNode":
        start_idx = self.cur_idx()
        bang_node = self.parse_word()

        while (peeked := self.peek()) is not None:
            _, c = peeked
            if c.isspace():
                self.skip_next()
            else:
                break

        if (peeked := self.peek()) and peeked[1] == "(":
            expr_node = self.parse_expr()
            children = [bang_node, expr_node]
        else:
            children = [bang_node]

        return SyntaxNode.new(SyntaxNodeType.CallGroup, range(start_idx, self.cur_idx()), children)

    def parse_comment(self) -> "SyntaxNode":
        start_idx = self.cur_idx()
        self.skip_next()
        while (peeked := self.peek()) is not None:
            _, c = peeked
            if c == "\n":
                break
            self.skip_next()
        return SyntaxNode.new(SyntaxNodeType.Comment, range(start_idx, self.cur_idx()), [])

    def parse_expr(self) -> "SyntaxNode":
        start_idx = self.cur_idx()
        children = [SyntaxNode.new(SyntaxNodeType.OpenParen, range(start_idx, start_idx + 1), [])]
        self.skip_next()

        Exp_type = SyntaxNodeType.ExpressionGroup 

        while True:
            while (peeked := self.peek()) is not None:
                _, c = peeked
                if c.isspace():
                    self.skip_next()
                    continue
                if c == ";":
                    children.append(self.parse_comment())
                    continue
                break

            peeked = self.peek()
            if peeked is None:
                return SyntaxNode.new(Exp_type, range(start_idx, self.cur_idx()), children)
            
            idx, c = peeked
            if c == ")":
                children.append(SyntaxNode.new(SyntaxNodeType.CloseParen, range(idx, idx + 1), []))
                self.skip_next()
                return SyntaxNode.new(Exp_type, range(start_idx, self.cur_idx()), children) 
            
            elif c == ":" and len(children) == 1:
                self.skip_next()
                children.append(SyntaxNode.new_token_node(SyntaxNodeType.WordToken, range(idx, idx + 1), ":"))
                Exp_type = SyntaxNodeType.TypeCheckGroup
            elif c == "=" and len(children) == 1:
                self.skip_next()
                next_non_ws = None
                while (peeked2 := self.peek()) is not None:
                    _, c2 = peeked2
                    if c2.isspace():
                        self.skip_next()
                        continue
                    next_non_ws = c2
                    break
                if next_non_ws == "=":
                    # It's a double equals, treat as function type
                    children.append(SyntaxNode.new_token_node(SyntaxNodeType.WordToken, range(idx, idx + 2), "=="))
                    self.skip_next()
                else:
                    # Single equals, treat as rule
                    children.append(SyntaxNode.new_token_node(SyntaxNodeType.WordToken, range(idx, idx + 1), "="))
                    Exp_type = SyntaxNodeType.RuleGroup
            else:
                child = self.parse_to_syntax_tree()
                if child:
                    children.append(child)
                else:
                    raise ValueError("Unexpected end of input inside expression")

    def parse_string(self) -> "SyntaxNode":
        start_idx = self.cur_idx()
        text = []
        self.skip_next()
        while (peeked := self.peek()) is not None:
            _, c = peeked
            self.skip_next()
            if c == '"':
                break
            text.append(c)
        return SyntaxNode.new_token_node(SyntaxNodeType.StringToken, range(start_idx, self.cur_idx()), "".join(text))

    def parse_word(self) -> "SyntaxNode":
        start_idx = self.cur_idx()
        text = []
        while (peeked := self.peek()) is not None:
            _, c = peeked
            if c.isspace() or c in "();":
                break
            text.append(c)
            self.skip_next()
        return SyntaxNode.new_token_node(SyntaxNodeType.WordToken, range(start_idx, self.cur_idx()), "".join(text))

    def parse_variable(self) -> "SyntaxNode":
        start_idx = self.cur_idx()
        text = []
        self.skip_next()
        while (peeked := self.peek()) is not None:
            _, c = peeked
            if c.isspace() or c in "();":
                break
            text.append(c)
            self.skip_next()
        return SyntaxNode.new_token_node(SyntaxNodeType.VariableToken, range(start_idx, self.cur_idx()), "".join(text))

def parse(code: str) -> List[SyntaxNode]:
    parser = SExprParser(code)
    roots = []
    while True:
        node = parser.parse_to_syntax_tree()
        if node is None:
            break
        roots.append(node)
    return roots

            

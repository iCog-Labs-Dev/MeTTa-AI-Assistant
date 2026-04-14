import { StreamLanguage, LanguageSupport } from "@codemirror/language";
import { getBuiltinNameSet, getKnownTypes } from "./stdlib";

const CORE_WORDS = new Set([
  "match",
  "if",
  "quote",
  "let",
  "and",
  "or",
  "not",
  "superpose",
  "collapse",
  "import!",
  "bind!",
]);

const DOC_WORDS = new Set([
  "@doc",
  "@desc",
  "@param",
  "@params",
  "@return",
  "@type",
  "@item",
  "@kind",
]);

const BUILTIN_NAMES = getBuiltinNameSet();
const TYPE_NAMES = new Set(getKnownTypes());

function readWhile(
  stream: { eol: () => boolean; peek: () => string | undefined; next: () => string | void },
  re: RegExp
) {
  while (!stream.eol()) {
    const peeked = stream.peek();
    if (peeked === undefined || !re.test(peeked)) break;
    stream.next();
  }
}

const mettaStream = StreamLanguage.define({
  startState() {
    return { inString: false, escaped: false };
  },

  token(
    stream: {
      eol: () => boolean;
      peek: () => string | undefined;
      next: () => string;
      sol: () => boolean;
      skipToEnd: () => void;
      match: (pattern: RegExp | string) => boolean;
      current: () => string;
    },
    state: { inString: boolean; escaped: boolean }
  ) {
    if (state.inString) {
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === undefined) break;
        if (state.escaped) {
          state.escaped = false;
        } else if (ch === "\\") {
          state.escaped = true;
        } else if (ch === '"') {
          state.inString = false;
          break;
        }
      }
      return "string";
    }

    const peeked = stream.peek();

    if (stream.sol() && peeked === ";") {
      stream.skipToEnd();
      return "comment";
    }

    if (peeked === ";") {
      stream.skipToEnd();
      return "comment";
    }

    if (stream.match(/\s+/)) {
      return null;
    }

    const ch = peeked;

    if (ch === undefined) {
      stream.next();
      return null;
    }

    if (ch === "(" || ch === ")") {
      stream.next();
      return "bracket";
    }

    if (ch === '"') {
      state.inString = true;
      stream.next();
      return "string";
    }

    if (ch === "$") {
      stream.next();
      readWhile(stream, /[A-Za-z0-9_!?-]/);
      return "variableName";
    }

    if (ch === "&") {
      stream.next();
      readWhile(stream, /[A-Za-z0-9_!?-]/);
      return "namespace";
    }

    if (stream.match(/-?\d+(?:\.\d+)?\b/)) {
      return "number";
    }

    if (stream.match(/(?:->|=>|!=|>=|<=|=|:|!|>|<)/)) {
      return "operator";
    }

    if (stream.match(/%[A-Za-z][A-Za-z0-9-]*%/)) {
      return "keyword";
    }

    if (stream.match(/@[A-Za-z][A-Za-z0-9-]*/)) {
      const value = stream.current();
      if (DOC_WORDS.has(value)) return "keyword";
      return "atom";
    }

    if (stream.match(/[A-Za-z_+*\/][A-Za-z0-9_!?+*\/@:%.-]*/)) {
      const value = stream.current();

      if (CORE_WORDS.has(value)) return "keyword";
      if (DOC_WORDS.has(value)) return "keyword";
      if (TYPE_NAMES.has(value)) return "keyword";
      if (BUILTIN_NAMES.has(value)) return "keyword";
      if (value === "True" || value === "False") return "keyword";

      return "atom";
    }

    stream.next();
    return null;
  },
});

export function mettaLanguage() {
  return new LanguageSupport(mettaStream);
}
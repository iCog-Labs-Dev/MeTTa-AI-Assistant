import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import {
  getBuiltinNames,
  getKnownTypes,
  getBuiltinNameSet,
} from "./stdlib";

type ListFrame = {
  start: number;
  head: string | null;
};

type ScanContextResult = {
  currentList: ListFrame | null;
  prevNonSpace: string;
  listText: string;
  parentHead: string | null;
  expectHead: boolean;
  inComment: boolean;
  inString: boolean;
};

type SymbolCollections = {
  vars: string[];
  spaces: string[];
  atoms: string[];
  heads: string[];
  types: string[];
};

const ROOT_WORDS = [
  "!",
  "match",
  "if",
  "quote",
  "let",
  "and",
  "or",
  "not",
  ":",
  "=",
];

const BUILTIN_NAME_SET = getBuiltinNameSet();
const BUILTIN_OPTIONS: Completion[] = getBuiltinNames().map((label) => ({
  label,
  type: "keyword",
}));

const TYPE_OPTIONS: Completion[] = getKnownTypes().map((label) => ({
  label,
  type: "keyword",
}));

const ROOT_OPTIONS: Completion[] = ROOT_WORDS.map((label) => ({
  label,
  type: "keyword",
}));

function uniqOptions(list: Completion[]): Completion[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = item.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function prefixInfo(doc: string, pos: number): { from: number; text: string } {
  let from = pos;
  while (from > 0) {
    const ch = doc[from - 1];
    if (!/[A-Za-z0-9_!?+*\/\-:$&><=%@]/.test(ch)) break;
    from--;
  }
  return { from, text: doc.slice(from, pos) };
}

function scanContext(doc: string, pos: number): ScanContextResult {
  const stack: ListFrame[] = [];
  let inString = false;
  let escaped = false;
  let inComment = false;
  let token = "";

  function flushToken() {
    if (!token) return;
    if (stack.length && stack[stack.length - 1].head == null) {
      stack[stack.length - 1].head = token;
    }
    token = "";
  }

  for (let i = 0; i < pos; i++) {
    const ch = doc[i];

    if (inComment) {
      if (ch === "\n") inComment = false;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === ";") {
      flushToken();
      inComment = true;
      continue;
    }

    if (ch === '"') {
      flushToken();
      inString = true;
      continue;
    }

    if (ch === "(") {
      flushToken();
      stack.push({ start: i, head: null });
      continue;
    }

    if (ch === ")") {
      flushToken();
      stack.pop();
      continue;
    }

    if (/\s/.test(ch)) {
      flushToken();
      continue;
    }

    token += ch;
  }

  flushToken();

  const currentList = stack[stack.length - 1] || null;

  const prevNonSpace = (() => {
    for (let i = pos - 1; i >= 0; i--) {
      if (!/\s/.test(doc[i])) return doc[i];
    }
    return "";
  })();

  return {
    currentList,
    prevNonSpace,
    listText: currentList ? doc.slice(currentList.start, pos) : "",
    parentHead: currentList?.head || null,
    expectHead: prevNonSpace === "(",
    inComment,
    inString,
  };
}

function collectSymbols(doc: string): SymbolCollections {
  const vars = new Set<string>();
  const spaces = new Set<string>(["&self"]);
  const atoms = new Set<string>();
  const heads = new Set<string>();
  const types = new Set<string>(getKnownTypes());

  const tokenRe =
    /\$[A-Za-z0-9_!?-]+|&[A-Za-z0-9_!?-]+|[A-Za-z_+*\/:%<>=-][A-Za-z0-9_!?+*\/:%<>=-]*/g;
  for (const match of doc.matchAll(tokenRe)) {
    const token = match[0];
    if (token.startsWith("$")) {
      vars.add(token);
    } else if (token.startsWith("&")) {
      spaces.add(token);
    } else if (!BUILTIN_NAME_SET.has(token) && !ROOT_WORDS.includes(token)) {
      atoms.add(token);
    }
  }

  const headRe = /\(([A-Za-z_+*\/:%<>=-][A-Za-z0-9_!?+*\/:%<>=-]*)/g;
  for (const match of doc.matchAll(headRe)) {
    heads.add(match[1]);
  }

  const fnDefRe = /\(=\s+\(([A-Za-z_+*\/:%<>=-][A-Za-z0-9_!?+*\/:%<>=-]*)/g;
  for (const match of doc.matchAll(fnDefRe)) {
    atoms.add(match[1]);
    heads.add(match[1]);
  }

  const typeDeclRe =
    /\(:\s+([A-Za-z_+*\/:%<>=-][A-Za-z0-9_!?+*\/:%<>=-]*)\s+([A-Za-z_+*\/:%<>=-][A-Za-z0-9_!?+*\/:%<>=-]*)/g;
  for (const match of doc.matchAll(typeDeclRe)) {
    atoms.add(match[1]);
    types.add(match[2]);
  }

  return {
    vars: [...vars],
    spaces: [...spaces],
    atoms: [...atoms],
    heads: [...heads],
    types: [...types],
  };
}

function currentScopeVars(listText: string): string[] {
  return [...new Set(listText.match(/\$[A-Za-z0-9_!?-]+/g) ?? [])];
}

function filterOptions(prefix: string, options: Completion[]): Completion[] {
  const needle = prefix.toLowerCase();
  return options.filter((option) =>
    option.label.toLowerCase().startsWith(needle)
  );
}

function symbolOptions(values: string[], type = "variable"): Completion[] {
  return values.map((label) => ({ label, type }));
}

export function mettaCompletionSource(
  context: CompletionContext
): CompletionResult | null {
  const doc = context.state.doc.toString();
  const { from, text: prefix } = prefixInfo(doc, context.pos);
  const parse = scanContext(doc, context.pos);
  const symbols = collectSymbols(doc);
  const scopeVars = currentScopeVars(parse.listText);

  if (parse.inComment || parse.inString) {
    return null;
  }

  let options: Completion[] = [];

  if (prefix.startsWith("$")) {
    options = uniqOptions([
      ...symbolOptions(scopeVars, "variable"),
      ...symbolOptions(symbols.vars, "variable"),
    ]);
  } else if (prefix.startsWith("&")) {
    options = uniqOptions(symbolOptions(symbols.spaces, "namespace"));
  } else if (parse.expectHead) {
    options = uniqOptions([
      ...ROOT_OPTIONS,
      ...symbolOptions(symbols.heads, "keyword"),
      ...BUILTIN_OPTIONS,
    ]);
  } else if (parse.parentHead === ":") {
    options = uniqOptions([
      ...TYPE_OPTIONS,
      ...symbolOptions(symbols.types, "keyword"),
    ]);
  } else {
    options = uniqOptions([
      ...BUILTIN_OPTIONS,
      ...symbolOptions(symbols.atoms, "text"),
      ...symbolOptions(scopeVars, "variable"),
      ...symbolOptions(symbols.vars, "variable"),
      ...symbolOptions(symbols.spaces, "namespace"),
    ]);
  }

  if (!prefix && !parse.expectHead && !context.explicit) {
    return null;
  }

  const filtered = prefix ? filterOptions(prefix, options) : options;

  if (!filtered.length) {
    return null;
  }

  return {
    from,
    options: filtered,
    validFor: /^[A-Za-z0-9_!?+*\/\-:$&><=%@]*$/,
  };
}
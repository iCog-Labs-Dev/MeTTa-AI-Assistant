import rawStdlib from "./metta-stdlib.json";

type StdlibJson = {
  schemaVersion: number;
  builtins: Record<string, string[]>;
};

const stdlib = rawStdlib as StdlibJson;

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function extractTypeTokens(signature: string): string[] {
  return signature.match(/%[A-Za-z][A-Za-z0-9-]*%|[A-Z][A-Za-z0-9-]*/g) ?? [];
}

export function getBuiltinNames(): string[] {
  return uniqueSorted(Object.keys(stdlib.builtins));
}

export function getBuiltinNameSet(): Set<string> {
  return new Set(getBuiltinNames());
}

export function getBuiltinSignatures(name: string): string[] {
  return stdlib.builtins[name] ?? [];
}

export function getKnownTypes(): string[] {
  const types = new Set<string>();

  for (const signatures of Object.values(stdlib.builtins)) {
    for (const signature of signatures) {
      for (const token of extractTypeTokens(signature)) {
        types.add(token);
      }
    }
  }

  return uniqueSorted(types);
}
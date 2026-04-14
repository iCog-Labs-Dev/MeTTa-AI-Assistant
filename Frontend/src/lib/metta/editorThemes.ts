import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const sharedSyntax = HighlightStyle.define([
  { tag: tags.keyword, color: "#60a5fa", fontWeight: "600" },

  { tag: tags.atom, color: "#f43f5e" },
  { tag: tags.variableName, color: "#e879f9" },

  { tag: tags.string, color: "#22c55e" },
  { tag: tags.number, color: "#38bdf8" },

  { tag: tags.comment, color: "#f59e0b", fontStyle: "italic" },
  { tag: tags.operator, color: "#f59e0b" },
  { tag: tags.paren, color: "#d4d4d8" },
]);

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#000000",
      color: "#f4f4f5",
      fontSize: "14px",
    },

    ".cm-scroller": {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineHeight: "1.65",
    },

    ".cm-content": {
      padding: "14px 0",
      caretColor: "#f4f4f5",
    },

    ".cm-line": {
      padding: "0 16px",
    },

    ".cm-gutters": {
      backgroundColor: "#000000",
      color: "#71717a",
      borderRight: "1px solid #18181b",
    },

    ".cm-activeLine": {
      backgroundColor: "transparent",
    },

    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#d4d4d8",
      fontWeight: "600",
    },

    "&.cm-focused": {
      outline: "none",
    },

    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#f4f4f5",
      borderLeftWidth: "2px",
    },

    ".cm-content ::selection": {
      backgroundColor: "rgba(59, 130, 246, 0.24)",
    },

    ".cm-tooltip": {
      border: "1px solid #27272a",
      backgroundColor: "#09090b",
      color: "#f4f4f5",
      borderRadius: "12px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
    },

    ".cm-tooltip-autocomplete": {
      overflow: "hidden",
      padding: "6px",
    },

    ".cm-tooltip-autocomplete > ul": {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      maxHeight: "240px",
    },

    ".cm-tooltip-autocomplete > ul > li": {
      padding: "8px 10px",
      borderRadius: "8px",
      color: "#e4e4e7",
    },

    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgba(59, 130, 246, 0.18)",
      color: "#ffffff",
    },

    ".cm-completionLabel": {
      color: "#f4f4f5",
    },

    ".cm-completionDetail": {
      color: "#a1a1aa",
      fontStyle: "normal",
    },

    ".cm-completionIcon": {
      color: "#60a5fa",
      opacity: 0.95,
    },

    ".cm-panels": {
      backgroundColor: "#000000",
      color: "#f4f4f5",
      borderBottom: "1px solid #18181b",
    },

    ".cm-searchMatch": {
      backgroundColor: "rgba(59, 130, 246, 0.18)",
      outline: "1px solid rgba(59, 130, 246, 0.35)",
    },
  },
  { dark: true }
);

const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#fafafa",
      color: "#18181b",
      fontSize: "14px",
    },

    ".cm-scroller": {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineHeight: "1.65",
    },

    ".cm-content": {
      padding: "14px 0",
      caretColor: "#18181b",
    },

    ".cm-line": {
      padding: "0 16px",
    },

    ".cm-gutters": {
      backgroundColor: "#fafafa",
      color: "#71717a",
      borderRight: "1px solid #e4e4e7",
    },

    ".cm-activeLine": {
      backgroundColor: "transparent",
    },

    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#27272a",
      fontWeight: "600",
    },

    "&.cm-focused": {
      outline: "none",
    },

    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#18181b",
      borderLeftWidth: "2px",
    },

    ".cm-content ::selection": {
      backgroundColor: "rgba(59, 130, 246, 0.18)",
    },

    ".cm-tooltip": {
      border: "1px solid #e4e4e7",
      backgroundColor: "#ffffff",
      color: "#18181b",
      borderRadius: "12px",
      boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
    },

    ".cm-tooltip-autocomplete": {
      overflow: "hidden",
      padding: "6px",
    },

    ".cm-tooltip-autocomplete > ul > li": {
      padding: "8px 10px",
      borderRadius: "8px",
      color: "#18181b",
    },

    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgba(59, 130, 246, 0.12)",
      color: "#111827",
    },

    ".cm-completionDetail": {
      color: "#71717a",
      fontStyle: "normal",
    },

    ".cm-completionIcon": {
      color: "#2563eb",
      opacity: 0.95,
    },
  },
  { dark: false }
);

export const editorThemes = {
  dark: [darkTheme, syntaxHighlighting(sharedSyntax)],
  light: [lightTheme, syntaxHighlighting(sharedSyntax)],
};
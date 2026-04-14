import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";

import { mettaLanguage } from "../../lib/metta/metta-language";
import { mettaCompletionSource } from "../../lib/metta/metta-context";
import { editorThemes } from "../../lib/metta/editorThemes";

interface PlaygroundEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme: "light" | "dark";
  className?: string;
}

const themeSlot = new Compartment();

function PlaygroundEditor({
  value,
  onChange,
  theme,
  className = "",
}: PlaygroundEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        closeBrackets(),
        mettaLanguage(),
        autocompletion({
          override: [mettaCompletionSource],
          activateOnTyping: true,
          maxRenderedOptions: 12,
        }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        themeSlot.of(editorThemes[theme]),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-editor": { height: "100%" },
          ".cm-scroller": {
            overflow: "auto",
            minHeight: "100%",
          },
          ".cm-content": {
            minHeight: "100%",
          },
        }),
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: themeSlot.reconfigure(editorThemes[theme]),
    });
  }, [theme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === value) return;

    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: value,
      },
    });
  }, [value]);

  return (
    <div
      className={`rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 h-full min-h-0 ${className}`}
    >
      <div ref={containerRef} className="h-full min-h-0" />
    </div>
  );
}

export default PlaygroundEditor;
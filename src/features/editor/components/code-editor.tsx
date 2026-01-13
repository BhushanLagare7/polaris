import { useEffect, useMemo, useRef } from "react";

import { indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";

import { customSetup } from "../extensions/custom-setup";
import { getLanguageExtension } from "../extensions/language-extension";
import { minimap } from "../extensions/minimap";
import { quickEdit } from "../extensions/quick-edit";
import { selectionTooltip } from "../extensions/selection-tooltip";
import { suggestion } from "../extensions/suggestion";
import { customTheme } from "../extensions/theme";

interface CodeEditorProps {
  fileName: string;
  initialValue?: string;
  onChange: (value: string) => void;
}

export const CodeEditor = ({
  fileName,
  initialValue = "",
  onChange,
}: CodeEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const languageExtension = useMemo(
    () => getLanguageExtension(fileName),
    [fileName]
  );

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      doc: initialValue,
      parent: editorRef.current,
      extensions: [
        oneDark,
        customTheme,
        customSetup,
        languageExtension,
        suggestion(fileName),
        quickEdit(fileName),
        selectionTooltip(),
        keymap.of([indentWithTab]),
        minimap(),
        indentationMarkers(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(view.state.doc.toString());
          }
        }),
      ],
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialValue is only used for initial document
  }, [languageExtension]);

  return <div ref={editorRef} className="pl-4 size-full bg-background" />;
};

import { EditorView } from "@codemirror/view";

export const customTheme = EditorView.theme({
  "&": {
    outline: "none !important",
  },
  ".cm-content": {
    fontFamily: "var(--font-plex-mono), monospace",
    fontSize: "14px",
  },
  ".cm-scroller": {
    scrollbarWidth: "thin",
    scrollbarColor: "#3F3F46 transparent",
  },
});

/**
 * @fileoverview CodeMirror 6 Extension for Inline Code Suggestions
 *
 * This module implements an inline code suggestion system for CodeMirror 6 editors.
 * It provides ghost-text style suggestions that appear at the cursor position and
 * can be accepted by pressing the Tab key.
 *
 * @module suggestion
 *
 * ## Features
 * - Debounced suggestion fetching to minimize API calls
 * - Abort controller support for canceling pending requests
 * - Ghost-text rendering with customizable styling
 * - Tab-to-accept functionality
 *
 * ## Architecture Overview
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                      User Types in Editor                       │
 * └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                                 ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │              Debounce Plugin (300ms delay)                      │
 * │  - Cancels previous timers/requests                             │
 * │  - Generates payload with context                               │
 * │  - Fetches suggestion from API                                  │
 * └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                                 ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │              State Effect → State Field                         │
 * │  - Stores current suggestion in editor state                    │
 * └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                                 ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │              Render Plugin                                      │
 * │  - Creates decoration with SuggestionWidget                     │
 * │  - Displays ghost text at cursor position                       │
 * └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                                 ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │              Accept Keymap (Tab)                                │
 * │  - Inserts suggestion text                                      │
 * │  - Clears suggestion state                                      │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * @example
 * // Basic usage with CodeMirror
 * import { EditorView, basicSetup } from "codemirror";
 * import { suggestion } from "./suggestion";
 *
 * const editor = new EditorView({
 *   extensions: [
 *     basicSetup,
 *     suggestion("myFile.ts")
 *   ],
 *   parent: document.getElementById("editor")
 * });
 */

import { StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  keymap,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";

import { fetcher } from "./fetcher";

/* =============================================================================
   STATE MANAGEMENT
   ============================================================================
   */

/**
 * State effect used to update the current suggestion in the editor state.
 *
 * @description
 * This effect is dispatched when:
 * - A new suggestion is received from the API (value: suggestion string)
 * - The suggestion should be cleared (value: null)
 * - The user accepts a suggestion (value: null)
 *
 * @type {StateEffect<string | null>}
 *
 * @example
 * // Dispatching a new suggestion
 * view.dispatch({
 *   effects: setSuggestionEffect.of("console.log('Hello');")
 * });
 *
 * // Clearing the suggestion
 * view.dispatch({
 *   effects: setSuggestionEffect.of(null)
 * });
 */
const setSuggestionEffect = StateEffect.define<string | null>();

/**
 * State field that holds the current suggestion text.
 *
 * @description
 * This field maintains the suggestion state across editor transactions.
 * It only updates when a `setSuggestionEffect` is present in the transaction.
 *
 * State Lifecycle:
 * ```
 * null (initial) → "suggestion text" (after fetch) → null (after accept/clear)
 * ```
 *
 * @type {StateField<string | null>}
 *
 * @example
 * // Reading the current suggestion
 * const currentSuggestion = view.state.field(suggestionState);
 * if (currentSuggestion) {
 *   console.log("Current suggestion:", currentSuggestion);
 * }
 */
const suggestionState = StateField.define<string | null>({
  /**
   * Initializes the suggestion state.
   * @returns {null} Initial state with no suggestion
   */
  create() {
    return null;
  },

  /**
   * Updates the suggestion state based on transaction effects.
   *
   * @param {string | null} value - Current suggestion value
   * @param {Transaction} transaction - The transaction being applied
   * @returns {string | null} Updated suggestion value
   */
  update(value, transaction) {
    // Iterate through all effects in the transaction
    for (const effect of transaction.effects) {
      // Check if this effect is a suggestion update
      if (effect.is(setSuggestionEffect)) {
        return effect.value;
      }
    }
    // No suggestion effect found, maintain current value
    return value;
  },
});

/* =============================================================================
   WIDGET RENDERING
   ============================================================================= */

/**
 * Custom widget class for rendering inline suggestions.
 *
 * @extends WidgetType
 *
 * @description
 * This widget creates a styled span element that displays the suggestion
 * as "ghost text" - semi-transparent and non-interactive text that appears
 * at the cursor position.
 *
 * Visual Appearance:
 * ```
 * const user|Code = "hello";
 *          ↑
 *          └── Suggestion appears here: "Name" (grayed out)
 *
 * Result: const user|Name = "hello";
 *                    ^^^^ (opacity: 0.4)
 * ```
 *
 * @example
 * const widget = new SuggestionWidget("completedText");
 * const decoration = Decoration.widget({ widget, side: 1 });
 */
class SuggestionWidget extends WidgetType {
  /**
   * Creates a new SuggestionWidget instance.
   *
   * @param {string} text - The suggestion text to display
   */
  constructor(readonly text: string) {
    super();
  }

  /**
   * Creates the DOM element for the suggestion widget.
   *
   * @returns {HTMLSpanElement} Styled span element containing the suggestion
   *
   * @description
   * The returned element has the following properties:
   * - opacity: 0.4 (makes it appear as ghost text)
   * - pointerEvents: none (prevents interaction/selection)
   */
  toDOM(): HTMLSpanElement {
    const span = document.createElement("span");
    span.textContent = this.text;
    span.style.opacity = "0.4"; // Ghost text appearance
    span.style.pointerEvents = "none"; // Prevent mouse interaction
    return span;
  }
}

/* =============================================================================
   GLOBAL STATE & CONSTANTS
   ============================================================================= */

/**
 * Timer ID for the debounce mechanism.
 * @type {number | null}
 */
let debounceTimer: number | null = null;

/**
 * Flag indicating whether a suggestion request is in progress.
 *
 * @description
 * This flag is used by the render plugin to determine whether to show
 * decorations. When true, no decorations are rendered to prevent
 * showing stale suggestions.
 *
 * @type {boolean}
 */
let isWaitingForSuggestion = false;

/**
 * AbortController for the current fetch request.
 *
 * @description
 * Used to cancel pending API requests when:
 * - A new keystroke triggers a new suggestion request
 * - The plugin is destroyed
 *
 * @type {AbortController | null}
 */
let currentAbortController: AbortController | null = null;

/**
 * Debounce delay in milliseconds.
 *
 * @description
 * The time to wait after the last keystroke before fetching a suggestion.
 * This prevents excessive API calls during rapid typing.
 *
 * @constant {number}
 * @default 300
 */
const DEBOUNCE_DELAY = 300;

/* =============================================================================
   PAYLOAD GENERATION
   ============================================================================= */

/**
 * Generates the payload for the suggestion API request.
 *
 * @param {EditorView} view - The CodeMirror editor view
 * @param {string} fileName - The name of the current file
 * @returns {SuggestionPayload | null} The payload object or null if invalid
 *
 * @description
 * This function extracts contextual information from the editor to provide
 * the suggestion API with relevant code context.
 *
 * Context Window:
 * ```
 * ┌─────────────────────────────────────┐
 * │  Previous 5 lines (max)             │ ← previousLines
 * ├─────────────────────────────────────┤
 * │  Current line with cursor position  │ ← currentLine, textBefore/AfterCursor
 * ├─────────────────────────────────────┤
 * │  Next 5 lines (max)                 │ ← nextLines
 * └─────────────────────────────────────┘
 * ```
 *
 * @example
 * const payload = generatePayload(view, "index.ts");
 * // Returns:
 * // {
 * //   fileName: "index.ts",
 * //   code: "entire document content",
 * //   currentLine: "const x = |",
 * //   previousLines: "import...\n...",
 * //   textBeforeCursor: "const x = ",
 * //   textAfterCursor: "",
 * //   nextLines: "...\n...",
 * //   lineNumber: 10
 * // }
 *
 * @typedef {Object} SuggestionPayload
 * @property {string} fileName - Name of the file being edited
 * @property {string} code - Complete document content
 * @property {string} currentLine - Text of the current line
 * @property {string} previousLines - Up to 5 previous lines joined by newlines
 * @property {string} textBeforeCursor - Text before cursor on current line
 * @property {string} textAfterCursor - Text after cursor on current line
 * @property {string} nextLines - Up to 5 following lines joined by newlines
 * @property {number} lineNumber - 1-based line number of cursor position
 */
const generatePayload = (view: EditorView, fileName: string) => {
  // Get the complete document content
  const code = view.state.doc.toString();

  // Validate that there's actual content to process
  if (!code || code.trim().length === 0) {
    return null;
  }

  // Get cursor position and current line information
  const cursorPosition = view.state.selection.main.head;
  const currentLine = view.state.doc.lineAt(cursorPosition);
  const cursorInLine = cursorPosition - currentLine.from;

  // ─────────────────────────────────────────────────────────────────────────────
  // Collect previous lines (up to 5 lines before current line)
  // ─────────────────────────────────────────────────────────────────────────────
  const previousLines: string[] = [];
  const previousLinesToFetch = Math.min(5, currentLine.number - 1);

  for (let i = previousLinesToFetch; i >= 1; i--) {
    previousLines.push(view.state.doc.line(currentLine.number - i).text);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Collect next lines (up to 5 lines after current line)
  // ─────────────────────────────────────────────────────────────────────────────
  const nextLines: string[] = [];
  const totalLines = view.state.doc.lines;
  const linesToFetch = Math.min(5, totalLines - currentLine.number);

  for (let i = 1; i <= linesToFetch; i++) {
    nextLines.push(view.state.doc.line(currentLine.number + i).text);
  }

  // Return the complete payload object
  return {
    fileName,
    code,
    currentLine: currentLine.text,
    previousLines: previousLines.join("\n"),
    textBeforeCursor: currentLine.text.slice(0, cursorInLine),
    textAfterCursor: currentLine.text.slice(cursorInLine),
    nextLines: nextLines.join("\n"),
    lineNumber: currentLine.number,
  };
};

/* =============================================================================
   DEBOUNCE PLUGIN
   ============================================================================= */

/**
 * Creates a debounce plugin for fetching suggestions.
 *
 * @param {string} fileName - The name of the file being edited
 * @returns {ViewPlugin} A CodeMirror ViewPlugin instance
 *
 * @description
 * This plugin monitors editor changes and triggers suggestion fetches
 * with debouncing to prevent excessive API calls.
 *
 * Debounce Flow:
 * ```
 * Keystroke 1 ──→ Start timer (300ms)
 *     │
 * Keystroke 2 ──→ Cancel timer, Start new timer (300ms)
 *     │
 * Keystroke 3 ──→ Cancel timer, Start new timer (300ms)
 *     │
 *     └──── 300ms passes ──→ Fetch suggestion
 * ```
 *
 * Abort Flow:
 * ```
 * Request 1 starts ──→ Keystroke ──→ Abort Request 1 ──→ Request 2 starts
 * ```
 *
 * @example
 * const plugin = createDebouncePlugin("myFile.ts");
 * // Use in extension array:
 * // extensions: [plugin, ...]
 */
const createDebouncePlugin = (fileName: string) =>
  ViewPlugin.fromClass(
    class {
      /**
       * Plugin constructor - called when the plugin is attached to an editor.
       *
       * @param {EditorView} view - The editor view instance
       */
      constructor(view: EditorView) {
        // Trigger initial suggestion on editor mount
        this.triggerSuggestion(view);
      }

      /**
       * Called when the editor view is updated.
       *
       * @param {ViewUpdate} update - The view update object
       *
       * @description
       * Triggers a new suggestion fetch when:
       * - The document content changes (docChanged)
       * - The cursor position changes (selectionSet)
       */
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.triggerSuggestion(update.view);
        }
      }

      /**
       * Triggers a debounced suggestion fetch.
       *
       * @param {EditorView} view - The editor view instance
       *
       * @description
       * This method:
       * 1. Clears any existing debounce timer
       * 2. Aborts any pending fetch request
       * 3. Sets the waiting flag
       * 4. Starts a new debounce timer
       * 5. After delay, generates payload and fetches suggestion
       * 6. Dispatches the result to update the state
       */
      triggerSuggestion(view: EditorView) {
        // ─────────────────────────────────────────────────────────────────────
        // Step 1: Clear existing debounce timer
        // ─────────────────────────────────────────────────────────────────────
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 2: Abort any pending fetch request
        // ─────────────────────────────────────────────────────────────────────
        if (currentAbortController !== null) {
          currentAbortController.abort();
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 3: Set waiting flag to prevent stale renders
        // ─────────────────────────────────────────────────────────────────────
        isWaitingForSuggestion = true;

        // ─────────────────────────────────────────────────────────────────────
        // Step 4 & 5: Start debounce timer and fetch after delay
        // ─────────────────────────────────────────────────────────────────────
        debounceTimer = window.setTimeout(async () => {
          // Generate the request payload
          const payload = generatePayload(view, fileName);

          // If payload is invalid (empty document), clear suggestion
          if (!payload) {
            isWaitingForSuggestion = false;
            view.dispatch({
              effects: setSuggestionEffect.of(null),
            });
            return;
          }

          // Create new abort controller for this request
          currentAbortController = new AbortController();

          // Fetch suggestion from API
          const suggestion = await fetcher(
            payload,
            currentAbortController.signal
          );

          // ─────────────────────────────────────────────────────────────────────
          // Step 6: Dispatch result to update state
          // ─────────────────────────────────────────────────────────────────────
          isWaitingForSuggestion = false;
          view.dispatch({
            effects: setSuggestionEffect.of(suggestion),
          });
        }, DEBOUNCE_DELAY);
      }

      /**
       * Cleanup method called when the plugin is destroyed.
       *
       * @description
       * Ensures proper cleanup of:
       * - Pending debounce timers
       * - In-flight fetch requests
       */
      destroy() {
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }
        if (currentAbortController !== null) {
          currentAbortController.abort();
        }
      }
    }
  );

/* =============================================================================
   RENDER PLUGIN
   ============================================================================= */

/**
 * Plugin responsible for rendering suggestion decorations.
 *
 * @description
 * This plugin manages the visual representation of suggestions in the editor.
 * It creates and updates decorations based on the current suggestion state.
 *
 * Decoration Strategy:
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  When to show decoration:                                       │
 * │  ✓ Suggestion exists in state                                   │
 * │  ✓ Not waiting for new suggestion                               │
 * │                                                                  │
 * │  When to hide decoration:                                        │
 * │  ✗ No suggestion in state                                        │
 * │  ✗ Currently waiting for suggestion (isWaitingForSuggestion)    │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * @type {ViewPlugin}
 */
const renderPlugin = ViewPlugin.fromClass(
  class {
    /**
     * Current set of decorations to render.
     * @type {DecorationSet}
     */
    decorations: DecorationSet;

    /**
     * Plugin constructor.
     *
     * @param {EditorView} view - The editor view instance
     */
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    /**
     * Called when the editor view is updated.
     *
     * @param {ViewUpdate} update - The view update object
     *
     * @description
     * Rebuilds decorations when:
     * - Document content changes (may invalidate suggestion position)
     * - Cursor moves (suggestion follows cursor)
     * - Suggestion state changes (new suggestion or cleared)
     */
    update(update: ViewUpdate) {
      // Check if document content changed
      const docChanged = update.docChanged;

      // Check if cursor position changed
      const cursorMoved = update.selectionSet;

      // Check if suggestion state was updated
      const suggestionChanged = update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(setSuggestionEffect))
      );

      // Determine if we need to rebuild decorations
      const shouldRebuild = docChanged || cursorMoved || suggestionChanged;

      if (shouldRebuild) {
        this.decorations = this.build(update.view);
      }
    }

    /**
     * Builds the decoration set for the current editor state.
     *
     * @param {EditorView} view - The editor view instance
     * @returns {DecorationSet} The decoration set to render
     *
     * @description
     * Returns an empty decoration set if:
     * - A suggestion fetch is in progress
     * - No suggestion exists in state
     *
     * Otherwise, creates a widget decoration at the cursor position.
     */
    build(view: EditorView): DecorationSet {
      // Don't show stale suggestions while waiting for new one
      if (isWaitingForSuggestion) {
        return Decoration.none;
      }

      // Get current suggestion from state
      const suggestion = view.state.field(suggestionState);

      // No suggestion to display
      if (!suggestion) {
        return Decoration.none;
      }

      // Get current cursor position
      const cursor = view.state.selection.main.head;

      // Create decoration set with widget at cursor position
      return Decoration.set([
        Decoration.widget({
          widget: new SuggestionWidget(suggestion),
          side: 1, // Render after the cursor position
        }).range(cursor),
      ]);
    }
  },
  {
    /**
     * Accessor function to get decorations from plugin instance.
     * Required by CodeMirror to know which decorations to render.
     */
    decorations: (plugin) => plugin.decorations,
  }
);

/* =============================================================================
   KEYMAP CONFIGURATION
   ============================================================================= */

/**
 * Keymap for accepting the current suggestion.
 *
 * @description
 * Binds the Tab key to accept the current suggestion. When pressed:
 * 1. Checks if a suggestion exists
 * 2. If yes: inserts the suggestion, moves cursor, clears state
 * 3. If no: returns false to allow default Tab behavior
 *
 * Key Binding Behavior:
 * ```
 * Tab pressed
 *     │
 *     ├── Suggestion exists?
 *     │       │
 *     │       ├── Yes ──→ Insert suggestion ──→ return true (handled)
 *     │       │
 *     │       └── No ──→ return false (let other handlers process)
 * ```
 *
 * @type {Extension}
 *
 * @example
 * // Before Tab press:
 * // const message = "Hello|" (suggestion: ", World!")
 * //
 * // After Tab press:
 * // const message = "Hello, World!|"
 */
const acceptSuggestionKeymap = keymap.of([
  {
    key: "Tab",
    /**
     * Handler for Tab key press.
     *
     * @param {EditorView} view - The editor view instance
     * @returns {boolean} true if suggestion was accepted, false otherwise
     */
    run: (view) => {
      // Get current suggestion from state
      const suggestion = view.state.field(suggestionState);

      // No suggestion to accept, let other handlers process Tab
      if (!suggestion) {
        return false;
      }

      // Get current cursor position
      const cursor = view.state.selection.main.head;

      // Dispatch transaction to:
      // 1. Insert the suggestion text at cursor
      // 2. Move cursor to end of inserted text
      // 3. Clear the suggestion state
      view.dispatch({
        changes: { from: cursor, insert: suggestion },
        selection: { anchor: cursor + suggestion.length },
        effects: setSuggestionEffect.of(null),
      });

      // Return true to indicate we handled the key
      return true;
    },
  },
]);

/* =============================================================================
   PUBLIC API
   ============================================================================= */

/**
 * Creates the complete suggestion extension for CodeMirror.
 *
 * @param {string} fileName - The name of the file being edited
 * @returns {Extension[]} Array of CodeMirror extensions
 *
 * @description
 * This is the main entry point for the suggestion feature. It bundles
 * all necessary extensions into a single array that can be added to
 * a CodeMirror editor.
 *
 * Included Extensions:
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  1. suggestionState      - State management for suggestions     │
 * │  2. createDebouncePlugin - Debounced API fetching              │
 * │  3. renderPlugin         - Visual rendering of suggestions      │
 * │  4. acceptSuggestionKeymap - Tab key handling                  │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * @example
 * import { EditorView, basicSetup } from "codemirror";
 * import { javascript } from "@codemirror/lang-javascript";
 * import { suggestion } from "./suggestion";
 *
 * const editor = new EditorView({
 *   doc: "// Start typing...\n",
 *   extensions: [
 *     basicSetup,
 *     javascript(),
 *     suggestion("index.js")  // Add suggestion support
 *   ],
 *   parent: document.getElementById("editor")
 * });
 *
 * @example
 * // Dynamic file name based on current tab
 * const currentFile = getCurrentFileName(); // "utils.ts"
 * const extensions = [
 *   basicSetup,
 *   suggestion(currentFile)
 * ];
 */
export const suggestion = (fileName: string) => [
  suggestionState,
  createDebouncePlugin(fileName),
  renderPlugin,
  acceptSuggestionKeymap,
];

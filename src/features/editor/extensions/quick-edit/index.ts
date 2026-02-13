/**
 * @fileoverview Quick Edit Extension for CodeMirror 6
 *
 * This module provides an AI-powered inline code editing feature for CodeMirror editors.
 * Users can select code, trigger a tooltip via keyboard shortcut (Mod+K), and provide
 * natural language instructions to modify the selected code.
 *
 * ## Features:
 * - Keyboard shortcut activation (Cmd/Ctrl + K)
 * - Inline tooltip UI with input field
 * - Async code transformation via external fetcher
 * - Cancellable requests with AbortController
 * - Automatic tooltip dismissal on empty selection
 *
 * ## Usage:
 * ```typescript
 * import { quickEdit } from './quick-edit';
 *
 * const editor = new EditorView({
 *   extensions: [quickEdit("example.ts")],
 *   parent: document.body
 * });
 * ```
 *
 * @module quick-edit
 */

import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView, keymap, showTooltip, Tooltip } from "@codemirror/view";

import { fetcher } from "./fetcher";

/* =============================================================================
 * STATE EFFECTS
 * ============================================================================= */

/**
 * State effect used to toggle the visibility of the Quick Edit tooltip.
 *
 * Dispatch this effect with `true` to show the Quick Edit UI,
 * or `false` to hide it.
 *
 * @example
 * ```typescript
 * // Show the quick edit tooltip
 * view.dispatch({
 *   effects: showQuickEditEffect.of(true)
 * });
 *
 * // Hide the quick edit tooltip
 * view.dispatch({
 *   effects: showQuickEditEffect.of(false)
 * });
 * ```
 */
export const showQuickEditEffect = StateEffect.define<boolean>();

/* =============================================================================
 * MODULE-LEVEL STATE
 * ============================================================================= */

/**
 * Cached reference to the current EditorView instance.
 *
 * This is necessary because the tooltip's event handlers need access to the
 * editor view, but the tooltip creation function only receives the EditorState.
 * The reference is updated via the `captureViewExtension` listener.
 *
 * @internal
 */
let editorView: EditorView | null = null;

/**
 * AbortController for the current in-flight fetch request.
 *
 * Used to cancel pending AI edit requests when:
 * - The user clicks the Cancel button
 * - The tooltip is dismissed before completion
 *
 * Set to `null` when no request is in progress.
 *
 * @internal
 */
let currentAbortController: AbortController | null = null;

/* =============================================================================
 * STATE FIELDS
 * ============================================================================= */

/**
 * State field that tracks whether the Quick Edit mode is currently active.
 *
 * ## State Transitions:
 * - `false` → `true`: When `showQuickEditEffect.of(true)` is dispatched
 * - `true` → `false`: When `showQuickEditEffect.of(false)` is dispatched
 *                     OR when the selection becomes empty
 *
 * ## Behavior:
 * - Initializes to `false` (Quick Edit hidden by default)
 * - Automatically deactivates when selection is cleared (safety mechanism)
 * - Responds only to explicit `showQuickEditEffect` effects
 *
 * @example
 * ```typescript
 * // Check if quick edit is currently active
 * const isActive = view.state.field(quickEditState);
 * ```
 */
export const quickEditState = StateField.define<boolean>({
  /**
   * Initialize the state to false (Quick Edit hidden).
   * @returns Initial state value
   */
  create() {
    return false;
  },

  /**
   * Update the state based on transactions.
   *
   * @param value - Current state value
   * @param transaction - The transaction being applied
   * @returns Updated state value
   */
  update(value, transaction) {
    // Check for explicit show/hide effects
    for (const effect of transaction.effects) {
      if (effect.is(showQuickEditEffect)) {
        return effect.value;
      }
    }

    // Auto-hide when selection becomes empty
    // This prevents orphaned tooltips when user clicks elsewhere
    if (transaction.selection) {
      const selection = transaction.state.selection.main;
      if (selection.empty) {
        return false;
      }
    }

    // Preserve current state if no relevant changes
    return value;
  },
});

/* =============================================================================
 * TOOLTIP CREATION
 * ============================================================================= */

/**
 * Creates the Quick Edit tooltip configuration based on current editor state.
 *
 * This function generates the tooltip UI that appears below the selected text,
 * containing:
 * - An input field for editing instructions
 * - A Cancel button to abort the operation
 * - A Submit button to send the edit request
 *
 * ## Tooltip Positioning:
 * - Positioned at the end of the selection (`selection.to`)
 * - Appears below the selection (`above: false`)
 * - Uses flexible positioning (`strictSide: false`)
 *
 * ## UI Structure:
 * ```
 * ┌──────────────────────────────────┐
 * │ [Edit selected code...        ]  │ ← Input field
 * │ [Cancel]              [Submit]   │ ← Button container
 * └──────────────────────────────────┘
 * ```
 *
 * @param state - Current editor state
 * @returns Array of Tooltip objects (empty if no tooltip should be shown)
 *
 * @internal
 */
const createQuickEditTooltip = (state: EditorState): readonly Tooltip[] => {
  // Get the primary selection range
  const selection = state.selection.main;

  // Don't show tooltip if nothing is selected
  if (selection.empty) {
    return [];
  }

  // Check if Quick Edit mode is active
  const isQuickEditActive = state.field(quickEditState);
  if (!isQuickEditActive) {
    return [];
  }

  // Return tooltip configuration
  return [
    {
      // Position tooltip at the end of the selection
      pos: selection.to,

      // Display tooltip below the selection
      above: false,

      // Allow tooltip to flip sides if needed for viewport fitting
      strictSide: false,

      /**
       * Creates the DOM structure for the tooltip.
       * Called once when the tooltip is first displayed.
       *
       * @returns Object containing the tooltip DOM element
       */
      create() {
        // ─────────────────────────────────────────────────────────────
        // Container Element
        // ─────────────────────────────────────────────────────────────
        const dom = document.createElement("div");
        dom.className =
          "bg-popover text-popover-foreground z-50 rounded-sm border border-input p-2 shadow-md flex flex-col gap-2 text-sm";

        // ─────────────────────────────────────────────────────────────
        // Form Element
        // ─────────────────────────────────────────────────────────────
        const form = document.createElement("form");
        form.className = "flex flex-col gap-2";

        // ─────────────────────────────────────────────────────────────
        // Instruction Input Field
        // ─────────────────────────────────────────────────────────────
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Edit selected code";
        input.className =
          "bg-transparent border-none outline-none px-2 py-1 font-sans w-100";
        input.autofocus = true;

        // ─────────────────────────────────────────────────────────────
        // Button Container
        // ─────────────────────────────────────────────────────────────
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "flex items-center justify-between gap-2";

        // ─────────────────────────────────────────────────────────────
        // Cancel Button
        // Aborts any in-flight request and closes the tooltip
        // ─────────────────────────────────────────────────────────────
        const cancelButton = document.createElement("button");
        cancelButton.type = "button"; // Prevents form submission
        cancelButton.className =
          "font-sans p-1 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-sm";
        cancelButton.textContent = "Cancel";

        /**
         * Cancel button click handler.
         * - Aborts any pending fetch request
         * - Dispatches effect to hide the Quick Edit tooltip
         */
        cancelButton.onclick = () => {
          // Abort any in-flight API request
          if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
          }

          // Close the Quick Edit tooltip
          if (editorView) {
            editorView.dispatch({
              effects: showQuickEditEffect.of(false),
            });
          }
        };

        // ─────────────────────────────────────────────────────────────
        // Submit Button
        // Sends the edit request to the AI service
        // ─────────────────────────────────────────────────────────────
        const submitButton = document.createElement("button");
        submitButton.type = "submit";
        submitButton.className =
          "font-sans p-1 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-sm";
        submitButton.textContent = "Submit";

        /**
         * Form submission handler.
         *
         * Workflow:
         * 1. Validates input and editor state
         * 2. Extracts selected code and full document context
         * 3. Shows loading state on submit button
         * 4. Sends request to AI service via fetcher
         * 5. On success: replaces selected code with AI response
         * 6. On failure: resets button to allow retry
         *
         * @param event - Form submission event
         */
        form.onsubmit = async (event) => {
          // Prevent default form submission (page reload)
          event.preventDefault();

          // Guard: ensure we have access to the editor
          if (!editorView) return;

          // Get and validate the user's instruction
          const instruction = input.value.trim();
          if (!instruction) return;

          // ─────────────────────────────────────────────────────────
          // Extract code context
          // ─────────────────────────────────────────────────────────
          const selection = editorView.state.selection.main;

          // The specific code the user selected for editing
          const selectedCode = editorView.state.doc.sliceString(
            selection.from,
            selection.to,
          );

          // Full document content (provides context for AI)
          const fullCode = editorView.state.doc.toString();

          // ─────────────────────────────────────────────────────────
          // Update UI to loading state
          // ─────────────────────────────────────────────────────────
          submitButton.disabled = true;
          submitButton.textContent = "Editing...";

          // ─────────────────────────────────────────────────────────
          // Send request to AI service
          // ─────────────────────────────────────────────────────────
          currentAbortController = new AbortController();

          const editedCode = await fetcher(
            {
              selectedCode, // Code to be modified
              fullCode, // Full file context
              instruction, // User's natural language instruction
            },
            currentAbortController.signal, // Allows request cancellation
          );

          // ─────────────────────────────────────────────────────────
          // Handle response
          // ─────────────────────────────────────────────────────────
          if (editedCode) {
            // Success: Replace selected code with AI-generated code
            editorView.dispatch({
              // Replace the selection with new code
              changes: {
                from: selection.from,
                to: selection.to,
                insert: editedCode,
              },
              // Move cursor to end of inserted code
              selection: {
                anchor: selection.from + editedCode.length,
              },
              // Close the Quick Edit tooltip
              effects: showQuickEditEffect.of(false),
            });
          } else {
            // Failure: Reset button to allow retry
            // This handles cases like network errors or empty responses
            submitButton.disabled = false;
            submitButton.textContent = "Submit";
          }

          // Clean up abort controller reference
          currentAbortController = null;
        };

        // ─────────────────────────────────────────────────────────────
        // Assemble DOM structure
        // ─────────────────────────────────────────────────────────────
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(submitButton);

        form.appendChild(input);
        form.appendChild(buttonContainer);

        dom.appendChild(form);

        // ─────────────────────────────────────────────────────────────
        // Auto-focus input field
        // Using setTimeout to ensure DOM is fully rendered
        // ─────────────────────────────────────────────────────────────
        setTimeout(() => {
          input.focus();
        }, 0);

        return { dom };
      },
    },
  ];
};

/**
 * State field that manages the Quick Edit tooltip display.
 *
 * This field is responsible for:
 * 1. Creating tooltips when Quick Edit mode is activated
 * 2. Updating tooltips when the document or selection changes
 * 3. Removing tooltips when Quick Edit mode is deactivated
 * 4. Providing tooltip data to CodeMirror's tooltip system
 *
 * ## Integration with showTooltip:
 * Uses `showTooltip.computeN` to provide multiple tooltips to the
 * CodeMirror tooltip system. The tooltips are recomputed whenever
 * this field's value changes.
 *
 * @internal
 */
const quickEditTooltipField = StateField.define<readonly Tooltip[]>({
  /**
   * Initialize tooltips based on initial state.
   * Typically returns empty array as Quick Edit starts inactive.
   *
   * @param state - Initial editor state
   * @returns Initial tooltip array
   */
  create(state) {
    return createQuickEditTooltip(state);
  },

  /**
   * Update tooltips based on state changes.
   *
   * @param tooltips - Current tooltip array
   * @param transaction - Transaction being applied
   * @returns Updated tooltip array
   */
  update(tooltips, transaction) {
    // Rebuild tooltips if document content changed
    // (selection positions may have shifted)
    if (transaction.docChanged || transaction.selection) {
      return createQuickEditTooltip(transaction.state);
    }

    // Rebuild tooltips if Quick Edit visibility changed
    for (const effect of transaction.effects) {
      if (effect.is(showQuickEditEffect)) {
        return createQuickEditTooltip(transaction.state);
      }
    }

    // No changes needed - return existing tooltips
    return tooltips;
  },

  /**
   * Provide tooltips to CodeMirror's tooltip system.
   *
   * `showTooltip.computeN` allows providing multiple tooltips,
   * recomputing whenever the source field changes.
   */
  provide: (field) =>
    showTooltip.computeN([field], (state) => state.field(field)),
});

/* =============================================================================
 * KEYMAP
 * ============================================================================= */

/**
 * Keyboard shortcuts for the Quick Edit feature.
 *
 * ## Keybindings:
 *
 * | Key     | Action                           | Condition          |
 * |---------|----------------------------------|-------------------|
 * | Mod-k   | Open Quick Edit tooltip          | Text is selected  |
 *
 * - `Mod` = Cmd on macOS, Ctrl on Windows/Linux
 *
 * @example
 * ```typescript
 * // The keymap is automatically included when using the quickEdit extension
 * // Users can press Cmd+K (Mac) or Ctrl+K (Windows/Linux) with text selected
 * ```
 */
const quickEditKeymap = keymap.of([
  {
    key: "Mod-k",

    /**
     * Handler for Mod+K keypress.
     *
     * @param view - The EditorView instance
     * @returns true if the keybinding was handled, false otherwise
     */
    run: (view) => {
      const selection = view.state.selection.main;

      // Only activate if there's selected text
      // Return false to allow other handlers to process the key
      if (selection.empty) return false;

      // Dispatch effect to show the Quick Edit tooltip
      view.dispatch({
        effects: showQuickEditEffect.of(true),
      });

      // Return true to indicate we handled this keybinding
      return true;
    },
  },
]);

/* =============================================================================
 * VIEW CAPTURE EXTENSION
 * ============================================================================= */

/**
 * Extension that captures and stores a reference to the EditorView.
 *
 * ## Purpose:
 * The tooltip creation function only receives EditorState, not EditorView.
 * However, event handlers within the tooltip (like form submission) need
 * access to the view to dispatch transactions. This extension solves that
 * by storing the view reference in a module-level variable.
 *
 * ## How it works:
 * - Subscribes to all editor updates via `EditorView.updateListener`
 * - On each update, stores the current view in `editorView`
 * - The stored reference is then accessible to tooltip event handlers
 *
 * @internal
 */
const captureViewExtension = EditorView.updateListener.of((update) => {
  editorView = update.view;
});

/* =============================================================================
 * PUBLIC API
 * ============================================================================= */

/**
 * Creates the Quick Edit extension bundle for CodeMirror.
 *
 * This is the main entry point for integrating the Quick Edit feature
 * into a CodeMirror editor. It returns an array of extensions that
 * together provide the complete functionality.
 *
 * ## Included Extensions:
 * 1. **quickEditState** - Tracks whether Quick Edit mode is active
 * 2. **quickEditTooltipField** - Manages tooltip creation and display
 * 3. **quickEditKeymap** - Provides Mod+K keyboard shortcut
 * 4. **captureViewExtension** - Captures EditorView reference for handlers
 *
 * ## Usage:
 * ```typescript
 * import { EditorView } from "@codemirror/view";
 * import { quickEdit } from "./quick-edit";
 *
 * const editor = new EditorView({
 *   doc: "// Your code here",
 *   extensions: [
 *     // ... other extensions
 *     quickEdit("example.ts"),
 *   ],
 *   parent: document.getElementById("editor")!,
 * });
 * ```
 *
 * ## Workflow:
 * ```
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ 1. User selects code in editor                                      │
 * │ 2. User presses Mod+K (Cmd+K on Mac, Ctrl+K on Windows/Linux)      │
 * │ 3. Quick Edit tooltip appears below selection                       │
 * │ 4. User types instruction (e.g., "convert to arrow function")       │
 * │ 5. User clicks Submit (or presses Enter)                            │
 * │ 6. Request sent to AI service with selected code + instruction      │
 * │ 7. AI response replaces the selected code                           │
 * │ 8. Tooltip closes, cursor positioned after new code                 │
 * └─────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * @param fileName - Name of the file being edited (for context in AI requests)
 * @returns Array of CodeMirror extensions
 *
 * @example
 * ```typescript
 * // Basic usage
 * const extensions = quickEdit("app.tsx");
 *
 * // With other extensions
 * const extensions = [
 *   javascript({ typescript: true }),
 *   quickEdit(),
 *   // ... more extensions
 * ];
 * ```
 */
export const quickEdit = () => [
  quickEditState,
  quickEditTooltipField,
  quickEditKeymap,
  captureViewExtension,
];

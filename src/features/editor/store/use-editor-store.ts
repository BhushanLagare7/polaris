/**
 * @fileoverview Editor Tab Management Store
 *
 * This module provides a Zustand-based state management solution for handling
 * editor tabs across multiple projects. It implements a VS Code-like tab system
 * with support for:
 *
 * - **Preview Tabs**: Single-click opens files in a preview mode (italicized tab)
 *   that gets replaced when another file is previewed.
 * - **Pinned Tabs**: Double-click or editing pins the tab permanently.
 * - **Project Isolation**: Each project maintains its own independent tab state.
 *
 * @module useEditorStore
 * @requires zustand
 * @requires convex/_generated/dataModel
 *
 * @example
 * // Basic usage in a React component
 * import { useEditorStore } from './path/to/store';
 *
 * function FileExplorer({ projectId }) {
 *   const { openFile, getTabState } = useEditorStore();
 *   const { openTabs, activeTabId } = getTabState(projectId);
 *
 *   const handleFileClick = (fileId) => {
 *     openFile(projectId, fileId, { pinned: false }); // Preview mode
 *   };
 *
 *   const handleFileDoubleClick = (fileId) => {
 *     openFile(projectId, fileId, { pinned: true }); // Pinned mode
 *   };
 *
 *   return (...);
 * }
 */

import { create } from "zustand";

import { Id } from "../../../../convex/_generated/dataModel";

/* ============================================================================
 * TYPE DEFINITIONS
 * ============================================================================ */

/**
 * Represents the state of tabs for a single project.
 *
 * @interface TabState
 * @property {Id<"files">[]} openTabs - Array of file IDs representing all open tabs
 *                                       in their display order (left to right).
 * @property {Id<"files"> | null} activeTabId - The currently focused/visible tab.
 *                                               Null if no tabs are open.
 * @property {Id<"files"> | null} previewTabId - The tab currently in preview mode.
 *                                                Preview tabs are temporary and get
 *                                                replaced when another file is previewed.
 *                                                Null if no preview tab exists.
 *
 * @example
 * // Example tab state with 3 open tabs, one being a preview
 * const tabState: TabState = {
 *   openTabs: ['file_1', 'file_2', 'file_3'],
 *   activeTabId: 'file_3',
 *   previewTabId: 'file_3' // file_3 is in preview mode (not yet pinned)
 * };
 */
interface TabState {
  openTabs: Id<"files">[];
  activeTabId: Id<"files"> | null;
  previewTabId: Id<"files"> | null;
}

/**
 * Default state for a project with no open tabs.
 * Used as fallback when accessing a project that hasn't been initialized.
 *
 * @constant {TabState}
 */
const defaultTabState: TabState = {
  openTabs: [],
  activeTabId: null,
  previewTabId: null,
};

/**
 * Complete interface for the Editor Store.
 * Manages tab state across multiple projects with methods for common tab operations.
 *
 * @interface EditorStore
 *
 * @property {Map<Id<"projects">, TabState>} tabs - Map storing tab state per project.
 *           Using a Map ensures O(1) lookup time for project-specific tab states.
 *
 * @property {Function} getTabState - Retrieves the current tab state for a project.
 * @property {Function} openFile - Opens a file in a new or existing tab.
 * @property {Function} closeTab - Closes a specific tab.
 * @property {Function} closeAllTabs - Closes all tabs for a project.
 * @property {Function} setActiveTab - Sets a tab as the active/focused tab.
 */
interface EditorStore {
  tabs: Map<Id<"projects">, TabState>;
  getTabState: (projectId: Id<"projects">) => TabState;
  openFile: (
    projectId: Id<"projects">,
    fileId: Id<"files">,
    options: { pinned: boolean }
  ) => void;
  closeTab: (projectId: Id<"projects">, fileId: Id<"files">) => void;
  closeAllTabs: (projectId: Id<"projects">) => void;
  setActiveTab: (projectId: Id<"projects">, fileId: Id<"files">) => void;
}

/* ============================================================================
 * STORE IMPLEMENTATION
 * ============================================================================ */

/**
 * Zustand store hook for managing editor tabs.
 *
 * This store implements a tab management system similar to VS Code's behavior:
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Tab Bar                                                    │
 * │  ┌──────────┐ ┌──────────┐ ┌────────────┐                  │
 * │  │ index.ts │ │ App.tsx  │ │ *utils.ts* │  ← Italic = Preview
 * │  └──────────┘ └──────────┘ └────────────┘                  │
 * │       ↑            ↑             ↑                          │
 * │    Pinned       Pinned       Preview                        │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * @returns {EditorStore} The editor store with all tab management methods
 *
 * @example
 * // Using in a component
 * function EditorTabs({ projectId }) {
 *   const { getTabState, closeTab, setActiveTab } = useEditorStore();
 *   const { openTabs, activeTabId, previewTabId } = getTabState(projectId);
 *
 *   return (
 *     <div className="tab-bar">
 *       {openTabs.map(fileId => (
 *         <Tab
 *           key={fileId}
 *           isActive={fileId === activeTabId}
 *           isPreview={fileId === previewTabId}
 *           onClick={() => setActiveTab(projectId, fileId)}
 *           onClose={() => closeTab(projectId, fileId)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 */
export const useEditorStore = create<EditorStore>()((set, get) => ({
  /**
   * Map storing tab states indexed by project ID.
   * Each project maintains its own independent tab state.
   * @type {Map<Id<"projects">, TabState>}
   */
  tabs: new Map(),

  /**
   * Retrieves the tab state for a specific project.
   *
   * @param {Id<"projects">} projectId - The unique identifier of the project
   * @returns {TabState} The current tab state, or default state if project not found
   *
   * @example
   * const { openTabs, activeTabId } = getTabState('project_123');
   * console.log(`${openTabs.length} tabs open`);
   */
  getTabState: (projectId) => {
    return get().tabs.get(projectId) ?? defaultTabState;
  },

  /**
   * Opens a file in the editor, handling preview and pinned tab logic.
   *
   * Behavior Matrix:
   * ┌─────────────────┬─────────────┬──────────────────────────────────────┐
   * │ File Status     │ Pinned?     │ Action                               │
   * ├─────────────────┼─────────────┼──────────────────────────────────────┤
   * │ Not open        │ false       │ Open as preview (replace existing)   │
   * │ Not open        │ true        │ Open as new pinned tab               │
   * │ Already open    │ false       │ Just activate the tab                │
   * │ Already open    │ true        │ Activate and pin (if was preview)    │
   * └─────────────────┴─────────────┴──────────────────────────────────────┘
   *
   * @param {Id<"projects">} projectId - The project containing the file
   * @param {Id<"files">} fileId - The file to open
   * @param {Object} options - Opening options
   * @param {boolean} options.pinned - If true, opens as pinned tab (double-click behavior)
   *                                   If false, opens as preview tab (single-click behavior)
   *
   * @example
   * // Single-click: Open as preview
   * openFile('project_1', 'file_abc', { pinned: false });
   *
   * // Double-click: Open as pinned (or pin existing preview)
   * openFile('project_1', 'file_abc', { pinned: true });
   */
  openFile: (projectId, fileId, { pinned }) => {
    // Create a new Map to maintain immutability for React re-renders
    const tabs = new Map(get().tabs);
    const tabState = tabs.get(projectId) ?? defaultTabState;
    const { openTabs, previewTabId } = tabState;
    const isOpen = openTabs.includes(fileId);

    /* ─────────────────────────────────────────────────────────────────────
     * CASE 1: Opening as preview (single-click on unopened file)
     *
     * Preview tabs are temporary placeholders. When a new file is previewed:
     * - If a preview tab already exists → Replace it with the new file
     * - If no preview tab exists → Add new tab at the end
     *
     * Visual Example:
     * Before: [pinned.ts] [*preview.ts*]    ← Click on "newFile.ts"
     * After:  [pinned.ts] [*newFile.ts*]    ← preview.ts is replaced
     * ───────────────────────────────────────────────────────────────────── */
    if (!isOpen && !pinned) {
      const newTabs = previewTabId
        ? // Replace existing preview tab in-place (maintains tab position)
          openTabs.map((id) => (id === previewTabId ? fileId : id))
        : // No preview exists, append to end
          [...openTabs, fileId];

      tabs.set(projectId, {
        openTabs: newTabs,
        activeTabId: fileId,
        previewTabId: fileId, // Mark as preview
      });

      set({ tabs });
      return;
    }

    /* ─────────────────────────────────────────────────────────────────────
     * CASE 2: Opening as pinned (double-click on unopened file)
     *
     * Pinned tabs are permanent until explicitly closed.
     * Simply adds new tab at the end without affecting preview tab.
     *
     * Visual Example:
     * Before: [index.ts] [*preview.ts*]     ← Double-click on "utils.ts"
     * After:  [index.ts] [*preview.ts*] [utils.ts]  ← New pinned tab added
     * ───────────────────────────────────────────────────────────────────── */
    if (!isOpen && pinned) {
      tabs.set(projectId, {
        ...tabState,
        openTabs: [...openTabs, fileId],
        activeTabId: fileId,
        // previewTabId unchanged - existing preview stays as preview
      });

      set({ tabs });
      return;
    }

    /* ─────────────────────────────────────────────────────────────────────
     * CASE 3: File is already open
     *
     * Two sub-cases:
     * a) Single-click on open tab → Just activate (focus) it
     * b) Double-click on preview tab → Pin it (remove from preview state)
     *
     * Visual Example (pinning a preview):
     * Before: [index.ts] [*preview.ts*]     ← Double-click on preview.ts
     * After:  [index.ts] [preview.ts]       ← No longer italic, now pinned
     * ───────────────────────────────────────────────────────────────────── */
    if (isOpen) {
      // Determine if we should convert preview → pinned
      const shouldPin = pinned && previewTabId === fileId;

      tabs.set(projectId, {
        ...tabState,
        activeTabId: fileId,
        // If pinning the current preview, clear previewTabId
        // Otherwise, if the file was the preview, it stays as preview
        previewTabId: shouldPin ? null : tabState.previewTabId,
      });

      set({ tabs });
    }
  },

  /**
   * Closes a specific tab and handles active tab reassignment.
   *
   * When closing the active tab, the next active tab is determined by:
   * 1. If tabs remain to the right → Select the tab at same index
   * 2. If closed tab was last → Select the new last tab
   * 3. If no tabs remain → Set activeTabId to null
   *
   * ```
   * Index:    0          1          2
   *        [file_a]   [file_b]   [file_c]
   *                      ↑
   *                   Active
   *
   * After closing file_b:
   *        [file_a]   [file_c]
   *                      ↑
   *                   Active (same index = 1)
   * ```
   *
   * @param {Id<"projects">} projectId - The project containing the tab
   * @param {Id<"files">} fileId - The file/tab to close
   *
   * @example
   * closeTab('project_1', 'file_xyz');
   */
  closeTab: (projectId, fileId) => {
    const tabs = new Map(get().tabs);
    const tabState = tabs.get(projectId) ?? defaultTabState;
    const { openTabs, activeTabId, previewTabId } = tabState;

    // Find the index of the tab to close
    const tabIndex = openTabs.indexOf(fileId);

    // Early return if file is not in open tabs (nothing to close)
    if (tabIndex === -1) return;

    // Create new array without the closed tab
    const newTabs = openTabs.filter((id) => id !== fileId);

    // Determine new active tab if we're closing the currently active tab
    let newActiveTabId = activeTabId;
    if (activeTabId === fileId) {
      if (newTabs.length === 0) {
        // No tabs left → No active tab
        newActiveTabId = null;
      } else if (tabIndex >= newTabs.length) {
        // Closed tab was at end → Select new last tab
        newActiveTabId = newTabs[newTabs.length - 1];
      } else {
        // Select tab at same index (the one that "slides in" from the right)
        newActiveTabId = newTabs[tabIndex];
      }
    }

    tabs.set(projectId, {
      openTabs: newTabs,
      activeTabId: newActiveTabId,
      // Clear preview if we're closing the preview tab
      previewTabId: previewTabId === fileId ? null : previewTabId,
    });

    set({ tabs });
  },

  /**
   * Closes all tabs for a specific project, resetting to default state.
   *
   * Useful for:
   * - "Close All" button/command
   * - Project cleanup on navigation
   * - Resetting editor state
   *
   * @param {Id<"projects">} projectId - The project whose tabs should be closed
   *
   * @example
   * // Close all tabs when switching projects
   * const handleProjectChange = (newProjectId) => {
   *   closeAllTabs(currentProjectId);
   *   navigate(`/project/${newProjectId}`);
   * };
   */
  closeAllTabs: (projectId) => {
    const tabs = new Map(get().tabs);
    tabs.set(projectId, defaultTabState);

    set({ tabs });
  },

  /**
   * Sets a specific tab as active without changing its pinned/preview status.
   *
   * Use this for:
   * - Clicking on a tab to focus it
   * - Programmatic tab switching
   * - Keyboard navigation between tabs
   *
   * @param {Id<"projects">} projectId - The project containing the tab
   * @param {Id<"files">} fileId - The file/tab to activate
   *
   * @example
   * // Tab click handler
   * <Tab onClick={() => setActiveTab(projectId, fileId)} />
   *
   * // Keyboard navigation
   * const handleKeyDown = (e) => {
   *   if (e.key === 'Tab' && e.ctrlKey) {
   *     const nextTab = getNextTab(openTabs, activeTabId);
   *     setActiveTab(projectId, nextTab);
   *   }
   * };
   */
  setActiveTab: (projectId, fileId) => {
    const tabs = new Map(get().tabs);
    const tabState = tabs.get(projectId) ?? defaultTabState;

    tabs.set(projectId, { ...tabState, activeTabId: fileId });

    set({ tabs });
  },
}));

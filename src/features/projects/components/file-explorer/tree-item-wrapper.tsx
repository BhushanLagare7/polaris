import { cn } from "@/lib/utils";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { Doc } from "../../../../../convex/_generated/dataModel";

import { getItemPadding } from "./constants";

interface TreeItemWrapperProps {
  item: Doc<"files">;
  children: React.ReactNode;
  level: number;
  isActive?: boolean;
  onClick?: () => void;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onDelete?: () => void;
  onDoubleClick?: () => void;
  onRename?: () => void;
}

export const TreeItemWrapper = ({
  item,
  children,
  level,
  isActive,
  onClick,
  onCreateFile,
  onCreateFolder,
  onDelete,
  onDoubleClick,
  onRename,
}: TreeItemWrapperProps) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          aria-label={`${item.type === "folder" ? "Folder" : "File"}: ${item.name || "Unnamed"}`}
          className={cn(
            "group flex items-center gap-1 w-full h-5.5 hover:bg-accent/30 outline-none focus:ring-1 focus:ring-inset focus:ring-ring",
            isActive && "bg-accent/30"
          )}
          style={{ paddingLeft: getItemPadding(level, item.type === "file") }}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename?.();
            }
          }}
        >
          {children}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-64"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {item.type === "folder" && (
          <>
            <ContextMenuItem className="text-sm" onClick={onCreateFile}>
              New File...
            </ContextMenuItem>
            <ContextMenuItem className="text-sm" onClick={onCreateFolder}>
              New Folder...
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem className="text-sm" onClick={onRename}>
          Rename...
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem className="text-sm" onClick={onDelete}>
          Delete Permanently...
          <ContextMenuShortcut>&#8984;Backspace</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

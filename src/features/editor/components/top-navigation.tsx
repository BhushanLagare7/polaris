import { XIcon } from "lucide-react";
import { FileIcon } from "@react-symbols/icons/utils";

import { useFile } from "@/features/projects/hooks/use-files";

import { cn } from "@/lib/utils";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

import { Id } from "../../../../convex/_generated/dataModel";
import { useEditor } from "../hooks/use-editor";

const Tab = ({
  fileId,
  isFirst,
  projectId,
}: {
  fileId: Id<"files">;
  isFirst: boolean;
  projectId: Id<"projects">;
}) => {
  const file = useFile(fileId);
  const { activeTabId, closeTab, openFile, previewTabId, setActiveTab } =
    useEditor(projectId);

  const isActive = activeTabId === fileId;
  const isPreview = previewTabId === fileId;
  const fileName = file?.name ?? "Loading...";

  return (
    <div
      className={cn(
        "flex items-center gap-2 h-8.75 pl-2 pr-1.5 cursor-pointer text-muted-foreground group border-y border-x border-transparent hover:bg-accent/30",
        isActive &&
          "bg-background text-foreground border-x-border border-b-background -mb-px drop-shadow",
        isFirst && "border-l-transparent!"
      )}
      onClick={() => setActiveTab(fileId)}
      onDoubleClick={() => openFile(fileId, { pinned: true })}
    >
      {file === undefined ? (
        <Spinner className="text-ring" />
      ) : (
        <FileIcon autoAssign className="size-4" fileName={fileName} />
      )}
      <span className={cn("text-sm whitespace-nowrap", isPreview && "italic")}>
        {fileName}
      </span>
      <button
        aria-label={`Close ${fileName}`}
        className={cn(
          "p-0.5 rounded-sm hover:bg-foreground/10 opacity-0 group-hover:opacity-100",
          isActive && "opacity-100"
        )}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          closeTab(fileId);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            closeTab(fileId);
          }
        }}
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
};

export const TopNavigation = ({ projectId }: { projectId: Id<"projects"> }) => {
  const { openTabs } = useEditor(projectId);

  return (
    <ScrollArea className="flex-1">
      <nav className="bg-sidebar flex items-center h-8.75 border-b">
        {openTabs.map((fileId, index) => (
          <Tab
            key={fileId}
            fileId={fileId}
            isFirst={index === 0}
            projectId={projectId}
          />
        ))}
      </nav>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

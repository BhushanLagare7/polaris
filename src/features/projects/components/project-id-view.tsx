"use client";

import { useState } from "react";
import { FaGithub } from "react-icons/fa";

import { Allotment } from "allotment";

import { EditorView } from "@/features/editor/components/editor-view";

import { cn } from "@/lib/utils";

import { Id } from "../../../../convex/_generated/dataModel";

import { FileExplorer } from "./file-explorer";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_SIDEBAR_WIDTH = 350;
const DEFAULT_MAIN_SIZE = 1000;

const Tab = ({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => {
  return (
    <div
      aria-selected={isActive}
      className={cn(
        "flex gap-2 items-center px-3 h-full border-r cursor-pointer text-muted-foreground hover:bg-accent/30",
        isActive && "bg-background text-foreground"
      )}
      role="tab"
      onClick={onClick}
    >
      <span className="text-sm">{label}</span>
    </div>
  );
};

interface ProjectIdViewProps {
  projectId: Id<"projects">;
}

export const ProjectIdView = ({ projectId }: ProjectIdViewProps) => {
  const [activeView, setActiveView] = useState<"editor" | "preview">("editor");

  return (
    <div className="flex flex-col h-full">
      <nav
        className="h-8.75 flex items-center bg-sidebar border-b"
        role="tablist"
      >
        <Tab
          isActive={activeView === "editor"}
          label="Code"
          onClick={() => setActiveView("editor")}
        />
        <Tab
          isActive={activeView === "preview"}
          label="Preview"
          onClick={() => setActiveView("preview")}
        />
        <div className="flex flex-1 justify-end h-full">
          <div
            aria-label="Export to GitHub"
            className="flex gap-1.5 items-center px-3 h-full border-l cursor-pointer text-muted-foreground hover:bg-accent/30"
          >
            <FaGithub className="size-3.5" />
            <span className="text-sm">Export</span>
          </div>
        </div>
      </nav>
      <div className="relative flex-1">
        <div
          className={cn(
            "absolute inset-0",
            activeView === "editor" ? "visible" : "invisible"
          )}
        >
          <Allotment defaultSizes={[DEFAULT_SIDEBAR_WIDTH, DEFAULT_MAIN_SIZE]}>
            <Allotment.Pane
              maxSize={MAX_SIDEBAR_WIDTH}
              minSize={MIN_SIDEBAR_WIDTH}
              preferredSize={DEFAULT_SIDEBAR_WIDTH}
              snap
            >
              <FileExplorer projectId={projectId} />
            </Allotment.Pane>
            <Allotment.Pane>
              <EditorView projectId={projectId} />
            </Allotment.Pane>
          </Allotment>
        </div>
        <div
          className={cn(
            "absolute inset-0",
            activeView === "preview" ? "visible" : "invisible"
          )}
        >
          <div>Preview</div>
        </div>
      </div>
    </div>
  );
};

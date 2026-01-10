"use client";

import { useState } from "react";
import { FaGithub } from "react-icons/fa";

import { cn } from "@/lib/utils";

import { Id } from "../../../../convex/_generated/dataModel";

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
          <div>Editor</div>
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

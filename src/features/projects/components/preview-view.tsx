"use client";
import { useState } from "react";

import { Allotment } from "allotment";
import {
  AlertTriangleIcon,
  Loader2Icon,
  RefreshCwIcon,
  TerminalSquareIcon,
} from "lucide-react";

import { PreviewSettingsPopover } from "@/features/preview/components/preview-settings-popover";
import { PreviewTerminal } from "@/features/preview/components/preview-terminal";
import { useWebContainer } from "@/features/preview/hooks/use-webcontainer";

import { Button } from "@/components/ui/button";

import { Id } from "../../../../convex/_generated/dataModel";
import { useProject } from "../hooks/use-projects";
export const PreviewView = ({ projectId }: { projectId: Id<"projects"> }) => {
  const project = useProject(projectId);
  const [showTerminal, setShowTerminal] = useState(true);
  const { status, previewUrl, error, restart, terminalOutput } =
    useWebContainer({
      projectId,
      enabled: true,
      settings: project?.settings,
    });
  const isLoading = status === "booting" || status === "installing";
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="h-8.75 flex items-center border-b bg-sidebar shrink-0">
        <Button
          className="h-full rounded-none"
          disabled={isLoading}
          size="sm"
          title="Restart container"
          variant="ghost"
          onClick={restart}
        >
          <RefreshCwIcon className="size-3" />
        </Button>
        <div className="flex flex-1 items-center px-3 h-full font-mono text-xs truncate bg-background border-x text-muted-foreground">
          {isLoading && (
            <div className="flex items-center gap-1.5">
              <Loader2Icon className="animate-spin size-3" />
              {status === "booting" ? "Starting..." : "Installing..."}
            </div>
          )}
          {previewUrl && <span className="truncate">{previewUrl}</span>}
          {!isLoading && !previewUrl && !error && <span>Ready to preview</span>}
        </div>
        <Button
          className="h-full rounded-none"
          size="sm"
          title="Toggle terminal"
          variant="ghost"
          onClick={() => setShowTerminal((value) => !value)}
        >
          <TerminalSquareIcon className="size-3" />
        </Button>
        <PreviewSettingsPopover
          initialValues={project?.settings}
          projectId={projectId}
          onSave={restart}
        />
      </div>
      <div className="flex-1 min-h-0">
        <Allotment vertical>
          <Allotment.Pane>
            {error && (
              <div className="flex justify-center items-center size-full text-muted-foreground">
                <div className="flex flex-col gap-2 items-center mx-auto max-w-md text-center">
                  <AlertTriangleIcon className="size-6" />
                  <p className="text-sm font-medium">{error}</p>
                  <Button size="sm" variant="outline" onClick={restart}>
                    <RefreshCwIcon className="size-4" />
                    Restart
                  </Button>
                </div>
              </div>
            )}
            {isLoading && !error && (
              <div className="flex justify-center items-center size-full text-muted-foreground">
                <div className="flex flex-col gap-2 items-center mx-auto max-w-md text-center">
                  <Loader2Icon className="animate-spin size-6" />
                  <p className="text-sm font-medium">Installing...</p>
                </div>
              </div>
            )}
            {previewUrl && (
              <iframe
                className="border-0 size-full"
                src={previewUrl}
                title="Preview"
              />
            )}
          </Allotment.Pane>
          {showTerminal && (
            <Allotment.Pane maxSize={500} minSize={100} preferredSize={200}>
              <div className="flex flex-col h-full border-t bg-background">
                <div className="h-7 flex items-center px-3 text-xs gap-1.5 text-muted-foreground border-b border-border/50 shrink-0">
                  <TerminalSquareIcon className="size-3" />
                  Terminal
                </div>
                <PreviewTerminal output={terminalOutput} />
              </div>
            </Allotment.Pane>
          )}
        </Allotment>
      </div>
    </div>
  );
};

import { useRef } from "react";
import Image from "next/image";

import { useFile, useUpdateFile } from "@/features/projects/hooks/use-files";

import { Id } from "../../../../convex/_generated/dataModel";
import { useEditor } from "../hooks/use-editor";

import { CodeEditor } from "./code-editor";
import { FileBreadcrumbs } from "./file-breadcrumbs";
import { TopNavigation } from "./top-navigation";

const DEBOUNCE_MS = 1500;

export const EditorView = ({ projectId }: { projectId: Id<"projects"> }) => {
  const { activeTabId } = useEditor(projectId);
  const activeFile = useFile(activeTabId);
  const updateFile = useUpdateFile();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isActiveFileBinary = activeFile && activeFile.storageId;
  const isActiveFileText = activeFile && !activeFile.storageId;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center">
        <TopNavigation projectId={projectId} />
      </div>
      {activeTabId && <FileBreadcrumbs projectId={projectId} />}
      <div className="flex-1 min-h-0 bg-background">
        {!activeFile && (
          <div className="flex justify-center items-center size-full">
            <Image
              alt="Polaris"
              className="opacity-25"
              height={50}
              src="/logo-alt.svg"
              width={50}
            />
          </div>
        )}
        {isActiveFileText && (
          <CodeEditor
            key={activeFile._id}
            fileName={activeFile.name}
            initialValue={activeFile.content}
            onChange={(content: string) => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }

              timeoutRef.current = setTimeout(() => {
                updateFile({ id: activeFile._id, content });
              }, DEBOUNCE_MS);
            }}
          />
        )}
        {isActiveFileBinary && <p>TODO: Implement binary file viewer</p>}
      </div>
    </div>
  );
};

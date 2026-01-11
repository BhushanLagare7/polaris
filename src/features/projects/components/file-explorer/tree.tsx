import { useState } from "react";

import { ChevronRightIcon } from "lucide-react";
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";

import {
  useCreateFile,
  useCreateFolder,
  useDeleteFile,
  useFolderContents,
  useRenameFile,
} from "@/features/projects/hooks/use-files";

import { cn } from "@/lib/utils";

import { Doc, Id } from "../../../../../convex/_generated/dataModel";

import { getItemPadding } from "./constants";
import { CreateInput } from "./create-input";
import { LoadingRow } from "./loading-row";
import { RenameInput } from "./rename-input";
import { TreeItemWrapper } from "./tree-item-wrapper";

export const Tree = ({
  item,
  level = 0,
  projectId,
}: {
  item: Doc<"files">;
  level?: number;
  projectId: Id<"projects">;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);

  const createFile = useCreateFile();
  const createFolder = useCreateFolder();
  const deleteFile = useDeleteFile();
  const renameFile = useRenameFile();

  const folderContents = useFolderContents({
    projectId,
    parentId: item._id,
    enabled: item.type === "folder" && isOpen,
  });

  const handleRename = (newName: string) => {
    setIsRenaming(false);

    if (newName === item.name) return;

    renameFile({
      id: item._id,
      newName,
    });
  };

  const handleCreate = (name: string) => {
    setCreating(null);
    if (creating === "file") {
      createFile({
        projectId,
        parentId: item._id,
        name,
        content: "",
      });
    } else if (creating === "folder") {
      createFolder({
        projectId,
        parentId: item._id,
        name,
      });
    }
  };

  const startCreating = (type: "file" | "folder") => {
    setIsOpen(true);
    setCreating(type);
  };

  if (item.type === "file") {
    const fileName = item.name;

    if (isRenaming) {
      return (
        <RenameInput
          defaultValue={fileName}
          isOpen
          level={level}
          type="file"
          onCancel={() => setIsRenaming(false)}
          onSubmit={handleRename}
        />
      );
    }

    return (
      <TreeItemWrapper
        isActive={false}
        item={item}
        level={level}
        onClick={() => {}}
        onCreateFile={() => {}}
        onCreateFolder={() => {}}
        onDelete={() => {
          // TODO: Close Tab
          deleteFile({ id: item._id });
        }}
        onDoubleClick={() => {}}
        onRename={() => setIsRenaming(true)}
      >
        <FileIcon autoAssign className="size-4" fileName={fileName} />
        <span className="text-sm truncate">{fileName}</span>
      </TreeItemWrapper>
    );
  }

  const folderName = item.name;

  const folderRender = (
    <>
      <div className="flex items-center gap-0.5">
        <ChevronRightIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground",
            isOpen && "rotate-90"
          )}
        />
        <FolderIcon className="size-4" folderName={folderName} />
      </div>
      <span className="text-sm truncate">{folderName}</span>
    </>
  );

  if (creating) {
    return (
      <>
        <button
          className="group flex items-center gap-1 h-5.5 hover:bg-accent/30 w-full"
          style={{ paddingLeft: getItemPadding(level, false) }}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {folderRender}
        </button>
        {isOpen && (
          <>
            {folderContents === undefined && <LoadingRow level={level + 1} />}
            <CreateInput
              level={level + 1}
              type={creating}
              onCancel={() => setCreating(null)}
              onSubmit={handleCreate}
            />
            {folderContents?.map((subItem) => (
              <Tree
                key={subItem._id}
                item={subItem}
                level={level + 1}
                projectId={projectId}
              />
            ))}
          </>
        )}
      </>
    );
  }

  if (isRenaming) {
    return (
      <>
        <RenameInput
          defaultValue={folderName}
          isOpen={isOpen}
          level={level}
          type="folder"
          onCancel={() => setIsRenaming(false)}
          onSubmit={handleRename}
        />
        {isOpen && (
          <>
            {folderContents === undefined && <LoadingRow level={level + 1} />}
            {folderContents?.map((subItem) => (
              <Tree
                key={subItem._id}
                item={subItem}
                level={level + 1}
                projectId={projectId}
              />
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <TreeItemWrapper
        isActive={false}
        item={item}
        level={level}
        onClick={() => setIsOpen((prev) => !prev)}
        onCreateFile={() => startCreating("file")}
        onCreateFolder={() => startCreating("folder")}
        onDelete={() => {
          // TODO: Close Tab
          deleteFile({ id: item._id });
        }}
        onRename={() => setIsRenaming(true)}
      >
        {folderRender}
      </TreeItemWrapper>
      {isOpen && (
        <>
          {folderContents === undefined && <LoadingRow level={level + 1} />}
          {folderContents?.map((subItem) => (
            <Tree
              key={subItem._id}
              item={subItem}
              level={level + 1}
              projectId={projectId}
            />
          ))}
        </>
      )}
    </>
  );
};

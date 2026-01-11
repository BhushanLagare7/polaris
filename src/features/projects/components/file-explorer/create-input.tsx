import { useState } from "react";

import { ChevronRightIcon } from "lucide-react";
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";

import { getItemPadding } from "./constants";

interface CreateInputProps {
  level: number;
  type: "file" | "folder";
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

export const CreateInput = ({
  level,
  type,
  onCancel,
  onSubmit,
}: CreateInputProps) => {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSubmit(trimmedValue);
    } else {
      onCancel();
    }
  };

  return (
    <div
      className="w-full flex items-center gap-1 h-5.5 bg-accent/30"
      style={{ paddingLeft: getItemPadding(level, type === "file") }}
    >
      <div className="flex items-center gap-0.5">
        {type === "folder" && (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        {type === "file" && (
          <FileIcon autoAssign className="size-4" fileName={value} />
        )}
        {type === "folder" && (
          <FolderIcon className="size-4" folderName={value} />
        )}
      </div>
      <input
        aria-label={`Create new ${type} name`}
        autoFocus
        className="flex-1 text-sm bg-transparent outline-none focus:ring-1 focus:ring-ring focus:ring-inset"
        type="text"
        value={value}
        onBlur={handleSubmit}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSubmit();
          }
          if (e.key === "Escape") {
            onCancel();
          }
        }}
      />
    </div>
  );
};

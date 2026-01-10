import { useState } from "react";
import { Poppins } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import { formatDistanceToNow } from "date-fns";
import { CloudCheckIcon, LoaderIcon } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Id } from "../../../../convex/_generated/dataModel";
import { useProject, useRenameProject } from "../hooks/use-projects";

const font = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const Navbar = ({ projectId }: { projectId: Id<"projects"> }) => {
  const project = useProject(projectId);
  const renameProject = useRenameProject();

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(project?.name || "");

  const handleStartRename = () => {
    if (!project) return;

    setNewName(project.name);
    setIsRenaming(true);
  };

  const handleSubmit = () => {
    if (!project) return;

    setIsRenaming(false);

    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName === project.name) return;

    renameProject({ id: projectId, name: trimmedName });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
    }
  };

  return (
    <nav className="flex gap-x-2 justify-between items-center border-b bg-sidebar">
      <div className="flex gap-x-2 items-center">
        <Breadcrumb>
          <BreadcrumbList className="gap-0!">
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="flex items-center gap-1.5">
                <Button asChild className="w-fit! p-1.5! h-7!" variant="ghost">
                  <Link href="/">
                    <Image alt="Logo" height={20} src="/logo.svg" width={20} />
                    <span className={cn("text-sm font-medium", font.className)}>
                      Polaris
                    </span>
                  </Link>
                </Button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="ml-0! mr-1" />
            <BreadcrumbItem>
              {isRenaming ? (
                <input
                  autoFocus
                  className="text-sm font-medium truncate bg-transparent outline-none text-foreground focus:ring-1 focus:ring-inset focus:ring-ring max-w-40"
                  type="text"
                  value={newName}
                  onBlur={handleSubmit}
                  onChange={(e) => setNewName(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={handleKeyDown}
                />
              ) : (
                <BreadcrumbPage
                  className="text-sm font-medium truncate cursor-pointer hover:text-primary max-w-40"
                  onClick={handleStartRename}
                >
                  {project?.name || "Loading..."}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {project?.importStatus === "importing" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <LoaderIcon className="animate-spin size-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>Importing...</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <CloudCheckIcon className="size-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              Saved{" "}
              {project?.updatedAt
                ? formatDistanceToNow(project.updatedAt, { addSuffix: true })
                : "Loading..."}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex gap-2 items-center p-1.5">
        <UserButton />
      </div>
    </nav>
  );
};

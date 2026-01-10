import { FaGithub } from "react-icons/fa";
import { useRouter } from "next/navigation";

import { AlertCircleIcon, GlobeIcon, Loader2Icon } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { Doc } from "../../../../convex/_generated/dataModel";
import { useProjects } from "../hooks/use-projects";

const getProjectIcon = (project: Doc<"projects">) => {
  switch (project.importStatus) {
    case "completed":
      return <FaGithub className="size-4 text-muted-foreground" />;
    case "failed":
      return <AlertCircleIcon className="size-4 text-muted-foreground" />;
    case "importing":
      return (
        <Loader2Icon className="animate-spin size-4 text-muted-foreground" />
      );
    default:
      return <GlobeIcon className="size-4 text-muted-foreground" />;
  }
};

interface ProjectsCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProjectsCommandDialog = ({
  open,
  onOpenChange,
}: ProjectsCommandDialogProps) => {
  const router = useRouter();

  const projects = useProjects();

  const handleSelect = (projectId: string) => {
    router.push(`/projects/${projectId}`);
    onOpenChange(false);
  };

  return (
    <CommandDialog
      description="Search and navigate to your projects"
      open={open}
      title="Search projects"
      onOpenChange={onOpenChange}
    >
      <CommandInput placeholder="Search projects..." />
      <CommandList>
        <CommandEmpty>No projects found.</CommandEmpty>
        <CommandGroup heading="Projects">
          {projects?.map((project) => (
            <CommandItem
              key={project._id}
              value={`${project.name}-${project._id}`}
              onSelect={() => handleSelect(project._id)}
            >
              {getProjectIcon(project)}
              <span>{project.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

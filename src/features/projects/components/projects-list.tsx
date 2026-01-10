import { FaGithub } from "react-icons/fa";
import Link from "next/link";

import { formatDistanceToNow } from "date-fns";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  GlobeIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";

import { Doc } from "../../../../convex/_generated/dataModel";
import { useProjectsPartial } from "../hooks/use-projects";

const formatTimestamp = (timestamp: number) =>
  formatDistanceToNow(new Date(timestamp), { addSuffix: true });

const getProjectIcon = (project: Doc<"projects">) => {
  switch (project.importStatus) {
    case "completed":
      return <FaGithub className="size-3.5 text-muted-foreground" />;
    case "failed":
      return <AlertCircleIcon className="size-3.5 text-muted-foreground" />;
    case "importing":
      return (
        <Loader2Icon className="size-3.5 text-muted-foreground animate-spin" />
      );
    default:
      return <GlobeIcon className="size-3.5 text-muted-foreground" />;
  }
};

interface ProjectItemProps {
  data: Doc<"projects">;
}

export const ProjectItem = ({ data }: ProjectItemProps) => {
  return (
    <Link
      className="flex justify-between items-center py-1 w-full text-sm font-medium text-foreground/60 hover:text-foreground group"
      href={`/projects/${data._id}`}
    >
      <div className="flex gap-2 items-center">
        {getProjectIcon(data)}
        <span className="truncate">{data.name}</span>
      </div>
      <span className="text-xs transition-colors text-muted-foreground group-hover:text-foreground/60">
        {formatTimestamp(data.updatedAt)}
      </span>
    </Link>
  );
};

const ContinueCard = ({ data }: { data: Doc<"projects"> }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">Last Updated</span>
      <Button
        asChild
        className="flex flex-col gap-2 justify-start items-start p-4 h-auto rounded-none border bg-background"
        variant="outline"
      >
        <Link className="group" href={`/projects/${data._id}`}>
          <div className="flex justify-between items-center w-full">
            <div className="flex gap-2 items-center">
              {getProjectIcon(data)}
              <span className="font-medium truncate">{data.name}</span>
            </div>
            <ArrowRightIcon className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(data.updatedAt)}
          </span>
        </Link>
      </Button>
    </div>
  );
};

interface ProjectsListProps {
  onViewAll: () => void;
}

export const ProjectsList = ({ onViewAll }: ProjectsListProps) => {
  const projects = useProjectsPartial(6);

  if (projects === undefined) {
    return <Spinner className="size-4 text-ring" />;
  }

  const [mostRecent, ...rest] = projects;

  return (
    <div className="flex flex-col gap-4">
      {mostRecent ? <ContinueCard data={mostRecent} /> : null}
      {rest.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Recent Projects
            </span>
            <button
              className="flex gap-2 items-center text-xs transition-colors text-muted-foreground hover:text-foreground"
              onClick={onViewAll}
            >
              <span>View All</span>
              <Kbd className="border bg-accent">&#8984;K</Kbd>
            </button>
          </div>
          <ul className="flex flex-col">
            {rest.map((project) => (
              <ProjectItem key={project._id} data={project} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

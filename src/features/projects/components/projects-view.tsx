/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { FaGithub } from "react-icons/fa";
import { Poppins } from "next/font/google";

import { SparkleIcon } from "lucide-react";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

import { useCreateProject } from "../hooks/use-projects";

import { ImportGithubDialog } from "./import-github-dialog";
import { ProjectsCommandDialog } from "./projects-command-dialog";
import { ProjectsList } from "./projects-list";

const font = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const ProjectsView = () => {
  const createProject = useCreateProject();

  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "k") {
          e.preventDefault();
          setCommandDialogOpen(true);
        }
        if (e.key === "i") {
          e.preventDefault();
          setImportDialogOpen(true);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <ProjectsCommandDialog
        open={commandDialogOpen}
        onOpenChange={setCommandDialogOpen}
      />
      <ImportGithubDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
      <div className="flex flex-col justify-center items-center p-6 min-h-screen bg-sidebar md:p-16">
        <div className="flex flex-col gap-4 items-center mx-auto w-full max-w-sm">
          <div className="flex gap-4 justify-between items-center w-full">
            <div className="flex gap-2 items-center w-full group/logo">
              <img
                alt="Polaris"
                className="size-[32px] md:size-[46px]"
                src="/logo.svg"
              />
              <h1
                className={cn(
                  "text-4xl md:text-5xl font-semibold",
                  font.className,
                )}
              >
                Polaris
              </h1>
            </div>
          </div>
          <div className="flex flex-col gap-4 w-full">
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="flex flex-col gap-6 justify-around items-start p-4 h-full rounded-none border bg-background"
                variant="outline"
                onClick={() => {
                  const projectName = uniqueNamesGenerator({
                    dictionaries: [adjectives, animals, colors],
                    length: 3,
                    separator: "-",
                  });
                  createProject({ name: projectName });
                }}
              >
                <div className="flex justify-between items-center w-full">
                  <SparkleIcon className="size-4" />
                  <Kbd className="border bg-accent">&#8984;J</Kbd>
                </div>
                <div>
                  <span className="text-sm">New</span>
                </div>
              </Button>
              <Button
                className="flex flex-col gap-6 justify-around items-start p-4 h-full rounded-none border bg-background"
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
              >
                <div className="flex justify-between items-center w-full">
                  <FaGithub className="size-4" />
                  <Kbd className="border bg-accent">&#8984;I</Kbd>
                </div>
                <div>
                  <span className="text-sm">Import</span>
                </div>
              </Button>
            </div>
            <ProjectsList onViewAll={() => setCommandDialogOpen(true)} />
          </div>
        </div>
      </div>
    </>
  );
};

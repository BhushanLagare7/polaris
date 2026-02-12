import React from "react";
import { FaGithub } from "react-icons/fa";
import Link from "next/link";

import ky, { HTTPError } from "ky";
import {
  CheckCheckIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useClerk } from "@clerk/nextjs";
import { useForm } from "@tanstack/react-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Id } from "../../../../convex/_generated/dataModel";
import { useProject } from "../hooks/use-projects";

const formSchema = z.object({
  repoName: z
    .string()
    .min(1, "Repository name is required")
    .max(100, "Repository name is too long")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Only alphanumeric characters, hyphens, underscores, and dots are allowed",
    ),
  visibility: z.enum(["public", "private"]),
  description: z.string().max(350, "Description is too long"),
});

interface ExportPopoverProps {
  projectId: Id<"projects">;
}

export const ExportPopover = ({ projectId }: ExportPopoverProps) => {
  const project = useProject(projectId);
  const [open, setOpen] = React.useState(false);
  const { openUserProfile } = useClerk();

  const exportStatus = project?.exportStatus;
  const exportRepoUrl = project?.exportRepoUrl;

  const form = useForm({
    defaultValues: {
      repoName: project?.name?.replace(/[^a-zA-Z0-9._-]/g, "-") ?? "",
      visibility: "private" as "public" | "private",
      description: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await ky.post("/api/github/export", {
          json: {
            projectId,
            repoName: value.repoName,
            visibility: value.visibility,
            description: value.description || undefined,
          },
        });

        toast.success("Export started...");
      } catch (error) {
        if (error instanceof HTTPError) {
          const body = await error.response.json<{ error: string }>();

          if (body.error?.includes("Github not connected")) {
            toast.error("Github account not connected", {
              action: {
                label: "Connect",
                onClick: () => openUserProfile(),
              },
            });
            setOpen(false);
            return;
          }
        }
        toast.error("Unable to export repository");
      }
    },
  });

  const handleCancelExport = async () => {
    try {
      await ky.post("/api/github/export/cancel", {
        json: { projectId },
      });
    } catch {
      toast.error("Failed to cancel export");
    }
  };

  const handleResetExport = async () => {
    try {
      await ky.post("/api/github/export/reset", {
        json: { projectId },
      });
      setOpen(false);
    } catch {
      toast.error("Failed to reset export status");
    }
  };

  const renderContent = () => {
    if (exportStatus === "exporting") {
      return (
        <div className="flex flex-col gap-3 items-center">
          <LoaderIcon className="animate-spin size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Exporting to GitHub...
          </p>
          <Button
            className="w-full"
            size="sm"
            variant="outline"
            onClick={handleCancelExport}
          >
            Cancel
          </Button>
        </div>
      );
    }

    if (exportStatus === "completed" && exportRepoUrl) {
      return (
        <div className="flex flex-col gap-3 items-center">
          <CheckCircle2Icon className="text-emerald-500 size-6" />
          <p className="text-sm font-medium">Repository created</p>
          <p className="text-xs text-center text-muted-foreground">
            Your project has been exported to GitHub.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <Button asChild className="w-full" size="sm">
              <Link
                href={exportRepoUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLinkIcon className="mr-1 size-4" />
                View on GitHub
              </Link>
            </Button>
            <Button
              className="w-full"
              size="sm"
              variant="outline"
              onClick={handleResetExport}
            >
              Close
            </Button>
          </div>
        </div>
      );
    }

    if (exportStatus === "failed") {
      return (
        <div className="flex flex-col gap-3 items-center">
          <XCircleIcon className="text-rose-500 size-6" />
          <p className="text-sm font-medium">Unable to export</p>
          <p className="text-xs text-center text-muted-foreground">
            Something went wrong. Please try again.
          </p>
          <Button
            className="w-full"
            size="sm"
            variant="outline"
            onClick={handleResetExport}
          >
            Retry
          </Button>
        </div>
      );
    }

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Export to GitHub</h4>
            <p className="text-xs text-muted-foreground">
              Export your project to a GitHub repository.
            </p>
          </div>
          <form.Field name="repoName">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Repository Name</FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id={field.name}
                    name={field.name}
                    placeholder="my-project"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="visibility">
            {(field) => {
              return (
                <Field>
                  <FieldLabel htmlFor={field.name}>Visibility</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value: "public" | "private") =>
                      field.handleChange(value)
                    }
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="description">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                  <Textarea
                    aria-invalid={isInvalid}
                    id={field.name}
                    name={field.name}
                    placeholder="A short description of your project"
                    rows={2}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                className="w-full"
                disabled={!canSubmit || isSubmitting}
                size="sm"
                type="submit"
              >
                {isSubmitting ? "Creating..." : "Create Repository"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    );
  };

  const getStatusIcon = () => {
    if (exportStatus === "exporting") {
      return <LoaderIcon className="size-3.5 animate-spin" />;
    }
    if (exportStatus === "completed") {
      return <CheckCheckIcon className="size-3.5 text-emerald-500" />;
    }
    if (exportStatus === "failed") {
      return <XCircleIcon className="size-3.5 text-red-500" />;
    }
    return <FaGithub className="size-3.5" />;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-1.5 h-full px-3 cursor-pointer text-muted-foreground border-l hover:bg-accent/30">
          {getStatusIcon()}
          <span className="text-sm">Export</span>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {renderContent()}
      </PopoverContent>
    </Popover>
  );
};

import { NonRetriableError } from "inngest";
import ky from "ky";
import { Octokit } from "octokit";

import { inngest } from "@/inngest/client";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

interface ExportToGithubEvent {
  projectId: Id<"projects">;
  repoName: string;
  visibility: "public" | "private";
  description?: string;
  githubToken: string;
}

type FileWithUrl = Doc<"files"> & {
  storageUrl: string | null;
};

export const exportToGithub = inngest.createFunction(
  {
    id: "export-to-github",
    cancelOn: [
      {
        event: "github/export.cancel",
        if: "event.data.projectId == async.data.projectId",
      },
    ],
    onFailure: async ({ event, step }) => {
      const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
      if (!internalKey) return;

      const { projectId } = event.data.event.data as ExportToGithubEvent;

      await step.run("set-failed-status", async () => {
        await convex.mutation(api.system.updateExportStatus, {
          internalKey,
          projectId,
          status: "failed",
        });
      });
    },
  },
  {
    event: "github/export.repo",
  },
  async ({ event, step }) => {
    const { projectId, repoName, visibility, description, githubToken } =
      event.data as ExportToGithubEvent;

    const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      throw new NonRetriableError(
        "POLARIS_CONVEX_INTERNAL_KEY is not configured",
      );
    }

    // SET STATUS TO EXPORTING
    await step.run("set-exporting-status", async () => {
      await convex.mutation(api.system.updateExportStatus, {
        internalKey,
        projectId,
        status: "exporting",
      });
    });

    const octokit = new Octokit({ auth: githubToken });

    // GET AUTHENTICATED USER
    const { data: user } = await step.run("get-github-user", async () => {
      return await octokit.rest.users.getAuthenticated();
    });

    // CREATE THE NEW REPOSITORY WITH "auto_init: true" TO HAVE AN INITIAL COMMIT
    const { data: repo } = await step.run("create-repo", async () => {
      return await octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        description: description || `Exported from Polaris`,
        private: visibility === "private",
        auto_init: true,
      });
    });

    // WAIT FOR GITHUB TO INITIALIZE THE REPO ("auto_init: true" IS ASYNC ON GITHUB'S SIDE)
    await step.sleep("wait-for-repo-init", "10s");
    // FETCH ALL PROJECT FILES WITH STORAGE URLS
    const files = await step.run("fetch-project-files", async () => {
      return (await convex.query(api.system.getProjectFilesWithUrls, {
        internalKey,
        projectId,
      })) as FileWithUrl[];
    });

    // BUILD A MAP OF FILE IDS TO THEIR FULL PATHS
    const buildFilePaths = (files: FileWithUrl[]) => {
      const fileMap = new Map<Id<"files">, FileWithUrl>();
      files.forEach((f) => fileMap.set(f._id, f));

      const getFullPath = (file: FileWithUrl): string => {
        if (!file.parentId) {
          return file.name;
        }

        const parent = fileMap.get(file.parentId);

        if (!parent) {
          return file.name;
        }

        return `${getFullPath(parent)}/${file.name}`;
      };

      const paths: Record<string, FileWithUrl> = {};
      files.forEach((file) => {
        paths[getFullPath(file)] = file;
      });

      return paths;
    };

    const filePaths = buildFilePaths(files);

    // FILTER TO ONLY ACTUAL FILES (NOT FOLDERS)
    const fileEntries = Object.entries(filePaths).filter(
      ([, file]) => file.type === "file",
    );

    if (fileEntries.length === 0) {
      throw new NonRetriableError("No files to export");
    }

    // FILTER OUT .github FILES (OAuth token restriction)
    const filteredFileEntries = fileEntries.filter(([path]) => {
      if (path.startsWith(".github/")) {
        console.log(`Skipping .github file (token restriction): ${path}`);
        return false;
      }
      return true;
    });

    if (filteredFileEntries.length === 0) {
      throw new NonRetriableError("No files to export after filtering");
    }

    console.log(
      `Exporting ${filteredFileEntries.length} files (${fileEntries.length - filteredFileEntries.length} skipped)`,
    );

    // GET THE INITIAL COMMIT SHA (for commit parent)
    const initialCommitSha = await step.run("get-initial-commit", async () => {
      const { data: ref } = await octokit.rest.git.getRef({
        owner: user.login,
        repo: repoName,
        ref: "heads/main",
      });
      return ref.object.sha;
    });

    // CREATE BLOBS FOR EACH FILE
    const treeItems = await step.run("create-blobs", async () => {
      const items: {
        path: string;
        mode: "100644";
        type: "blob";
        sha: string;
      }[] = [];

      for (const [path, file] of filteredFileEntries) {
        let content: string;
        let encoding: "utf-8" | "base64" = "utf-8";

        if (file.content !== undefined) {
          // TEXT FILE
          content = file.content;
        } else if (file.storageUrl) {
          // BINARY FILE - FETCH AND BASE64 ENCODE
          const response = await ky.get(file.storageUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          content = buffer.toString("base64");
          encoding = "base64";
        } else {
          // SKIP FILES WITH NO CONTENT
          continue;
        }

        const { data: blob } = await octokit.rest.git.createBlob({
          owner: user.login,
          repo: repoName,
          content,
          encoding,
        });

        items.push({
          path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }

      return items;
    });

    if (treeItems.length === 0) {
      throw new NonRetriableError("Failed to create any file blobs");
    }

    console.log(`Created ${treeItems.length} blobs successfully`);

    // CREATE THE TREE
    const { data: tree } = await step.run("create-tree", async () => {
      return await octokit.rest.git.createTree({
        owner: user.login,
        repo: repoName,
        tree: treeItems,
      });
    });

    // CREATE THE COMMIT WITH THE INITIAL COMMIT AS PARENT
    const { data: commit } = await step.run("create-commit", async () => {
      return await octokit.rest.git.createCommit({
        owner: user.login,
        repo: repoName,
        message: `Export from Polaris (${treeItems.length} files)`,
        tree: tree.sha,
        parents: [initialCommitSha],
      });
    });

    // UPDATE THE MAIN BRANCH REFERENCE TO POINT TO OUR NEW COMMIT
    await step.run("update-branch-ref", async () => {
      return await octokit.rest.git.updateRef({
        owner: user.login,
        repo: repoName,
        ref: "heads/main",
        sha: commit.sha,
        force: true,
      });
    });

    // SET STATUS TO COMPLETED WITH REPO URL
    await step.run("set-completed-status", async () => {
      await convex.mutation(api.system.updateExportStatus, {
        internalKey,
        projectId,
        status: "completed",
        exportRepoUrl: repo.html_url,
      });
    });

    return {
      success: true,
      repoUrl: repo.html_url,
      filesExported: treeItems.length,
    };
  },
);

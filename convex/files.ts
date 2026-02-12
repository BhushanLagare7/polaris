import { ConvexError, v } from "convex/values";

import { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./auth";

export const getFiles = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (project.ownerId !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not authorized to access this project",
      });
    }

    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getFile = query({
  args: {
    id: v.id("files"),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);
    if (!file) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "File not found",
      });
    }

    const project = await ctx.db.get("projects", file.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (project.ownerId !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not authorized to access this file",
      });
    }

    return file;
  },
});

export const getFilePath = query({
  args: {
    id: v.id("files"),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);
    if (!file) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "File not found",
      });
    }

    const project = await ctx.db.get("projects", file.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (project.ownerId !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not authorized to access this file",
      });
    }

    const path: { _id: string; name: string }[] = [];
    let currentId: Id<"files"> | undefined = args.id;

    while (currentId) {
      const file = (await ctx.db.get("files", currentId)) as
        | Doc<"files">
        | undefined;

      if (!file) break;

      path.unshift({ _id: file._id, name: file.name });
      currentId = file.parentId;
    }

    return path;
  },
});

export const getFolderContents = query({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (project.ownerId !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not authorized to access this project",
      });
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    // SORT: FOLDERS FIRST, THEN FILES, ALPHABETICALLY WITHIN EACH GROUP
    files.sort((a, b) => {
      // FOLDERS COME BEFORE FILES
      if (a.type === "folder" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "folder") return 1;
      // BOTH ARE FOLDERS OR BOTH ARE FILES, SORT ALPHABETICALLY BY NAME
      return a.name.localeCompare(b.name);
    });

    return files;
  },
});

export const createFile = mutation({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    name: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (project.ownerId !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not authorized to access this project",
      });
    }

    // CHECK IF FILE WITH SAME NAME ALREADY EXISTS IN THEIR PARENT FOLDER
    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    const existingFile = files.find(
      (file) => file.name === args.name && file.type === "file",
    );
    if (existingFile) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "File with same name already exists",
      });
    }

    const now = Date.now();

    await ctx.db.insert("files", {
      projectId: args.projectId,
      parentId: args.parentId,
      name: args.name,
      content: args.content,
      type: "file",
      updatedAt: now,
    });

    // UPDATE PROJECT "updatedAt"
    await ctx.db.patch(args.projectId, {
      updatedAt: now,
    });
  },
});

export const createFolder = mutation({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (project.ownerId !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not authorized to access this project",
      });
    }

    // CHECK IF FOLDER WITH SAME NAME ALREADY EXISTS IN THEIR PARENT FOLDER
    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    const existingFolder = files.find(
      (file) => file.name === args.name && file.type === "folder",
    );
    if (existingFolder) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Folder with same name already exists",
      });
    }

    const now = Date.now();

    await ctx.db.insert("files", {
      projectId: args.projectId,
      parentId: args.parentId,
      name: args.name,
      type: "folder",
      updatedAt: now,
    });

    // UPDATE PROJECT "updatedAt"
    await ctx.db.patch(args.projectId, {
      updatedAt: now,
    });
  },
});

export const renameFile = mutation({
  args: {
    id: v.id("files"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);
    if (!file) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "File not found",
      });
    }

    const project = await ctx.db.get("projects", file.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (project.ownerId !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not authorized to access this file",
      });
    }

    /**
     * CHECK IF A FILE WITH THE NEW NAME ALREADY EXISTS IN THE SAME PARENT
     * FOLDER
     */
    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", file.projectId).eq("parentId", file.parentId),
      )
      .collect();

    const existingFile = siblings.find(
      (file) =>
        file.name === args.newName &&
        file.type === file.type &&
        file._id !== args.id,
    );
    if (existingFile) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `${file.type === "folder" ? "Folder" : "File"} with same name already exists`,
      });
    }

    const now = Date.now();

    // UPDATE THE FILE NAME
    await ctx.db.patch(args.id, {
      name: args.newName,
      updatedAt: now,
    });

    // UPDATE PROJECT "updatedAt"
    await ctx.db.patch(file.projectId, {
      updatedAt: now,
    });
  },
});

export const deleteFile = mutation({
  args: {
    id: v.id("files"),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);
    if (!file) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "File not found",
      });
    }

    const project = await ctx.db.get("projects", file.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (project.ownerId !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not authorized to access this file",
      });
    }

    // RECURSIVELY DELETE FILE/FOLDER AND ALL DESCENDANTS
    const deleteRecursive = async (fileId: Id<"files">) => {
      const file = await ctx.db.get("files", fileId);
      if (!file) {
        return;
      }

      // IF IT'S A FOLDER, DELETE ALL FILES IN IT
      if (file.type === "folder") {
        const childrenFiles = await ctx.db
          .query("files")
          .withIndex("by_project_parent", (q) =>
            q.eq("projectId", file.projectId).eq("parentId", fileId),
          )
          .collect();

        for (const childFile of childrenFiles) {
          await deleteRecursive(childFile._id);
        }
      }

      // DELETE STORAGE FILES IF IT EXISTS
      if (file.storageId) {
        await ctx.storage.delete(file.storageId);
      }

      // DELETE THE FILE/FOLDER ITSELF
      await ctx.db.delete("files", fileId);
    };

    await deleteRecursive(args.id);

    // UPDATE PROJECT "updatedAt"
    await ctx.db.patch(file.projectId, {
      updatedAt: Date.now(),
    });
  },
});

export const updateFile = mutation({
  args: {
    id: v.id("files"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);
    if (!file) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "File not found",
      });
    }

    const project = await ctx.db.get("projects", file.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (project.ownerId !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not authorized to access this file",
      });
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      content: args.content,
      updatedAt: now,
    });

    // UPDATE PROJECT "updatedAt"
    await ctx.db.patch(file.projectId, {
      updatedAt: now,
    });
  },
});

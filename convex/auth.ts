import { ConvexError } from "convex/values";

import { MutationCtx, QueryCtx } from "./_generated/server";

export const verifyAuth = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return identity;
};

import { NextResponse } from "next/server";

import * as z from "zod";
import { auth } from "@clerk/nextjs/server";

import { inngest } from "@/inngest/client";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";

const requestSchema = z.object({
  projectId: z.string(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId } = requestSchema.parse(body);

  const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
  if (!internalKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const event = await inngest.send({
    name: "github/export.cancel",
    data: { projectId },
  });

  // UPDATE STATUS TO CANCELLED
  await convex.mutation(api.system.updateExportStatus, {
    internalKey,
    projectId: projectId as Id<"projects">,
    status: "cancelled",
  });

  return NextResponse.json({ success: true, projectId, eventId: event.ids[0] });
}

import { NextResponse } from "next/server";

import * as z from "zod";
import { auth } from "@clerk/nextjs/server";

import { inngest } from "@/inngest/client";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const requestSchema = z.object({
  projectId: z.string(),
});

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const { projectId } = requestSchema.parse(body);
    if (!projectId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      return NextResponse.json(
        { error: "Internal key not configured" },
        { status: 500 },
      );
    }

    // FIND ALL PROCESSING MESSAGES IN THIS PROJECT
    const processingMessages = await convex.query(
      api.system.getProcessingMessages,
      { internalKey, projectId: projectId as Id<"projects"> },
    );

    if (processingMessages.length === 0) {
      return NextResponse.json({ success: true, cancelled: false });
    }

    // CANCEL ALL PROCESSING MESSAGES
    const cancelledIds = await Promise.all(
      processingMessages.map(async (message) => {
        await inngest.send({
          name: "message/cancel",
          data: {
            messageId: `${message._id}`,
          },
        });

        await convex.mutation(api.system.updateMessageStatus, {
          internalKey,
          messageId: message._id,
          status: "cancelled",
        });

        return message._id;
      }),
    );

    return NextResponse.json({
      success: true,
      cancelled: true,
      messageIds: cancelledIds,
    });
  } catch (error) {
    console.error("Error cancelling messages:", error);
    return NextResponse.json(
      { error: "Failed to cancel messages" },
      { status: 500 },
    );
  }
}

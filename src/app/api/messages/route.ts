import { NextResponse } from "next/server";

import * as z from "zod";
import { auth } from "@clerk/nextjs/server";

import { inngest } from "@/inngest/client";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

const requestSchema = z.object({
  conversationId: z.string(),
  message: z.string(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      return NextResponse.json(
        { error: "Internal key not configured" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const { conversationId, message } = requestSchema.parse(body);

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: "Missing conversationId or message" },
        { status: 400 },
      );
    }

    // CALL CONVEX MUTATION, QUERY
    const conversation = await convex.query(api.system.getConversationById, {
      conversationId: conversationId as Id<"conversations">,
      internalKey,
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const projectId = conversation.projectId;

    // FIND ALL PROCESSING MESSAGES IN THIS PROJECT
    const processingMessages = await convex.query(
      api.system.getProcessingMessages,
      { internalKey, projectId },
    );

    if (processingMessages.length > 0) {
      // CANCEL ALL PROCESSING MESSAGES
      await Promise.all(
        processingMessages.map(async (message) => {
          await inngest.send({
            name: "message/cancel",
            data: {
              messageId: message._id,
            },
          });

          await convex.mutation(api.system.updateMessageStatus, {
            internalKey,
            messageId: message._id,
            status: "cancelled",
          });
        }),
      );
    }

    // CREATE USER MESSAGE
    await convex.mutation(api.system.createMessage, {
      internalKey,
      conversationId: conversationId as Id<"conversations">,
      content: message,
      projectId,
      role: "user",
    });

    // CREATE ASSISTANT MESSAGE PLACEHOLDER WITH PROCESSING STATUS
    const assistantMessageId = await convex.mutation(api.system.createMessage, {
      internalKey,
      conversationId: conversationId as Id<"conversations">,
      content: "",
      projectId,
      role: "assistant",
      status: "processing",
    });

    // SEND EVENT TO INNGEST TO PROCESS THE MESSAGE
    const event = await inngest.send({
      name: "message/sent",
      data: {
        conversationId,
        message,
        messageId: assistantMessageId,
        projectId,
      },
    });

    return NextResponse.json({
      success: true,
      eventId: event.ids[0] ?? null,
      messageId: assistantMessageId,
    });
  } catch (error) {
    console.error("Error in POST /api/messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

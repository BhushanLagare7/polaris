import { NextResponse } from "next/server";

import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";
import * as z from "zod";
import { auth } from "@clerk/nextjs/server";

import { DEFAULT_CONVERSATION_TITLE } from "@/features/conversations/constants";
import { inngest } from "@/inngest/client";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";

const requestSchema = z.object({
  prompt: z.string().min(1),
});

export async function POST(request: Request) {
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

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { prompt } = parsed.data;

  // GENERATE A RANDOM PROJECT NAME
  const projectName = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: "-",
    length: 3,
  });

  // CREATE PROJECT AND CONVERSATION TOGETHER
  const { projectId, conversationId } = await convex.mutation(
    api.system.createProjectWithConversation,
    {
      projectName,
      ownerId: userId,
      internalKey,
      conversationTitle: DEFAULT_CONVERSATION_TITLE,
    },
  );

  // CREATE USER MESSAGE
  await convex.mutation(api.system.createMessage, {
    internalKey,
    conversationId,
    projectId,
    role: "user",
    content: prompt,
  });

  // CREATE ASSISTANT MESSAGE PLACEHOLDER WITH PROCESSING STATUS
  const assistantMessageId = await convex.mutation(api.system.createMessage, {
    internalKey,
    conversationId,
    projectId,
    role: "assistant",
    content: "",
    status: "processing",
  });

  // TRIGGER INNGEST TO PROCESS THE MESSAGE
  await inngest.send({
    name: "message/sent",
    data: {
      projectId,
      conversationId,
      messageId: assistantMessageId,
      message: prompt,
    },
  });

  return NextResponse.json({ projectId });
}

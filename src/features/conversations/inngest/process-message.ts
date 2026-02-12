import { NonRetriableError } from "inngest";
import { createAgent, createNetwork, gemini } from "@inngest/agent-kit";

import { inngest } from "@/inngest/client";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { DEFAULT_CONVERSATION_TITLE } from "../constants";

import { createCreateFilesTool } from "./tools/create-files";
import { createCreateFolderTool } from "./tools/create-folder";
import { createDeleteFilesTool } from "./tools/delete-files";
import { createListFilesTool } from "./tools/list-files";
import { createReadFilesTool } from "./tools/read-files";
import { createRenameFileTool } from "./tools/rename-file";
import { createScrapeUrlsTool } from "./tools/scrape-urls";
import { createUpdateFileTool } from "./tools/update-file";
import {
  CODING_AGENT_SYSTEM_PROMPT,
  TITLE_GENERATOR_SYSTEM_PROMPT,
} from "./constants";

interface MessageEvent {
  conversationId: Id<"conversations">;
  message: string;
  messageId: Id<"messages">;
  projectId: Id<"projects">;
}

export const processMessage = inngest.createFunction(
  {
    id: "process-message",
    cancelOn: [
      {
        event: "message/cancel",
        if: "event.data.messageId == async.data.messageId",
        // match: "data.messageId",
      },
    ],
    onFailure: async ({ event, step }) => {
      const { messageId } = event.data.event.data as MessageEvent;
      const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;

      // UPDATE THE MESSAGE WITH ERROR CONTENT
      if (internalKey) {
        await step.run("update-message-on-failure", async () => {
          await convex.mutation(api.system.updateMessageContent, {
            internalKey,
            messageId,
            content:
              "My apologies, I encountered an error while processing your request. Let me know if you need anything else!",
          });
        });
      }
    },
  },
  {
    event: "message/sent",
  },
  async ({ event, step }) => {
    const { conversationId, message, messageId, projectId } =
      event.data as MessageEvent;

    const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      throw new NonRetriableError(
        "POLARIS_CONVEX_INTERNAL_KEY is not configured",
      );
    }

    // TODO: Check if this is needed
    await step.sleep("wait-for-db-sync", "1s");

    // GET CONVERSATION FOR TITLE GENERATION CHECK
    const conversation = await step.run("get-conversation", async () => {
      return await convex.query(api.system.getConversationById, {
        conversationId,
        internalKey,
      });
    });

    if (!conversation) {
      throw new NonRetriableError("Conversation not found");
    }

    // FETCH RECENT MESSAGES FOR CONVERSATION CONTEXT
    const recentMessages = await step.run("get-recent-messages", async () => {
      return await convex.query(api.system.getRecentMessages, {
        conversationId,
        internalKey,
        limit: 10,
      });
    });

    /**
     * BUILD SYSTEM PROMPT WITH CONVERSATION HISTORY (EXCLUDE THE CURRENT
     * PROCESSING MESSAGE)
     */
    let systemPrompt = CODING_AGENT_SYSTEM_PROMPT;

    // FILTER OUT THE CURRENT PROCESSING MESSAGE AND EMPTY MESSAGES
    const contextMessages = recentMessages.filter(
      (m) => m._id !== messageId && m.content.trim() !== "",
    );

    if (contextMessages.length > 0) {
      const historyText = contextMessages
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n\n");

      systemPrompt += `\n\n## Previous Conversation (for context only - do NOT repeat these responses):\n${historyText}\n\n## Current Request:\nRespond ONLY to the user's new message below. Do not repeat or reference your previous responses.`;
    }

    // GENERATE CONVERSATION TITLE IF IT'S STILL THE DEFAULT
    const shouldGenerateTitle =
      conversation.title === DEFAULT_CONVERSATION_TITLE;

    if (shouldGenerateTitle) {
      const titleAgent = createAgent({
        name: "title-generator",
        system: TITLE_GENERATOR_SYSTEM_PROMPT,
        model: gemini({
          model: "gemini-2.5-flash",
        }),
      });

      const { output } = await titleAgent.run(message, { step });

      const textMessage = output.find(
        (m) => m.role === "assistant" && m.type === "text",
      );

      if (textMessage?.type === "text") {
        const title =
          typeof textMessage.content === "string"
            ? textMessage.content.trim()
            : textMessage.content
                .map((c) => c.text)
                .join(" ")
                .trim();

        if (title) {
          await step.run("update-conversation-title", async () => {
            await convex.mutation(api.system.updateConversationTitle, {
              internalKey,
              conversationId,
              title,
            });
          });
        }
      }
    }

    // CREATE THE CODING AGENT WITH FILE TOOLS
    const codingAgent = createAgent({
      name: "polaris",
      description: "An expert AI coding assistant",
      system: systemPrompt,
      model: gemini({
        model: "gemini-2.5-flash",
      }),
      tools: [
        createListFilesTool({ internalKey, projectId }),
        createReadFilesTool({ internalKey }),
        createUpdateFileTool({ internalKey }),
        createCreateFilesTool({ internalKey, projectId }),
        createCreateFolderTool({ internalKey, projectId }),
        createRenameFileTool({ internalKey }),
        createDeleteFilesTool({ internalKey }),
        createScrapeUrlsTool(),
      ],
    });

    // CREATE A NETWORK WITH SINGLE AGENT
    const network = createNetwork({
      name: "polaris-network",
      agents: [codingAgent],
      maxIter: 20,
      router: ({ network }) => {
        const lastResult = network.state.results.at(-1);
        const hasTextResponse = lastResult?.output.some(
          (m) => m.role === "assistant" && m.type === "text",
        );

        const hasToolCalls = lastResult?.output.some(
          (m) => m.type === "tool_call",
        );

        /**
         * ANTHROPIC OUTPUTS TEXT AND TOOL CALLS IN THE SAME RESPONSE
         * ONLY STOP IF THERE'S TEXT WITHOUT TOOLS CALLS (FINAL RESPONSE)
         */
        if (hasTextResponse && !hasToolCalls) {
          return undefined;
        }

        return codingAgent;
      },
    });

    // RUN THE NETWORK (THIS WILL RUN THE AGENT UNTIL IT STOPS)
    const result = await network.run(message);

    // EXTRACT THE ASSISTANT'S TEXT RESPONSE FROM THE LAST AGENT RESULT
    const lastResult = result.state.results.at(-1);
    const textMessage = lastResult?.output.find(
      (m) => m.role === "assistant" && m.type === "text",
    );

    let assistantResponse =
      "I processed your request. Let me know if you need anything else!";

    if (textMessage?.type === "text") {
      assistantResponse =
        typeof textMessage.content === "string"
          ? textMessage.content
          : textMessage.content.map((c) => c.text).join("");
    }

    /**
     * UPDATE THE ASSISTANT MESSAGE WITH THE RESPONSE (THIS ALSO SETS THE
     * STATUS TO COMPLETED)
     */
    await step.run("update-assistant-message", async () => {
      await convex.mutation(api.system.updateMessageContent, {
        internalKey,
        messageId,
        content: assistantResponse,
      });
    });

    return { success: true, messageId, conversationId };
  },
);

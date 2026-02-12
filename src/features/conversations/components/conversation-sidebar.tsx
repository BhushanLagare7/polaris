import { useState } from "react";

import ky from "ky";
import { CopyIcon, HistoryIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";

import { Id } from "../../../../convex/_generated/dataModel";
import { DEFAULT_CONVERSATION_TITLE } from "../constants";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useMessages,
} from "../hooks/use-conversations";

import { PastConversationsDialog } from "./past-conversations-dialog";

export const ConversationSidebar = ({
  projectId,
}: {
  projectId: Id<"projects">;
}) => {
  const [input, setInput] = useState("");
  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [pastConversationsDialogOpen, setPastConversationsDialogOpen] =
    useState(false);

  const createConversation = useCreateConversation();
  const conversations = useConversations(projectId);

  const activeConversationId =
    selectedConversationId ?? conversations?.[0]?._id ?? null;

  const activeConversation = useConversation(activeConversationId);
  const conversationMessages = useMessages(activeConversationId);

  // CHECK IF ANY MESSAGE IS CURRENTLY PROCESSING
  const isProcessing = conversationMessages?.some(
    (message) => message.status === "processing",
  );

  const handleCancel = async () => {
    try {
      await ky.post("/api/messages/cancel", {
        json: {
          projectId,
        },
      });
    } catch (error) {
      console.error("Failed to cancel conversation:", error);
      toast.error("Failed to cancel conversation");
    }
  };

  const handleCreateConversation = async () => {
    try {
      const newConversationId = await createConversation({
        projectId,
        title: DEFAULT_CONVERSATION_TITLE,
      });
      setSelectedConversationId(newConversationId);

      return newConversationId;
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast.error("Failed to create conversation");

      return null;
    }
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    // IF PROCESSING AND NO NEW MESSAGE, THIS IS JUST A STOP FUNCTION
    if (isProcessing && !message.text) {
      await handleCancel();
      setInput("");
      return;
    }

    let conversationId = activeConversationId;
    if (!conversationId) {
      conversationId = await handleCreateConversation();
      if (!conversationId) {
        return;
      }
    }

    // TRIGGER INNGEST FUNCTION VIA API
    try {
      await ky.post("/api/messages", {
        json: {
          conversationId,
          message: message.text,
        },
      });
      setInput("");
    } catch (error) {
      console.error("Failed to trigger inngest function:", error);
      toast.error("Failed to send message");
      return;
    }
  };

  return (
    <>
      <PastConversationsDialog
        open={pastConversationsDialogOpen}
        projectId={projectId}
        onOpenChange={setPastConversationsDialogOpen}
        onSelect={setSelectedConversationId}
      />
      <div className="flex flex-col h-full bg-sidebar">
        <div className="h-8.75 flex items-center justify-between border-b">
          <div className="pl-3 text-sm truncate">
            {activeConversation?.title ?? DEFAULT_CONVERSATION_TITLE}
          </div>
          <div className="flex gap-1 items-center px-1">
            <Button
              size="icon-xs"
              variant="highlight"
              onClick={() => setPastConversationsDialogOpen(true)}
            >
              <HistoryIcon className="size-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="highlight"
              onClick={handleCreateConversation}
            >
              <PlusIcon className="size-3.5" />
            </Button>
          </div>
        </div>
        <Conversation className="flex-1">
          <ConversationContent>
            {conversationMessages?.map((message, messageIndex) => (
              <Message key={message._id} from={message.role}>
                <MessageContent>
                  {message.status === "processing" ? (
                    <div className="flex gap-2 items-center text-muted-foreground">
                      <LoaderIcon className="animate-spin size-4" />
                      <span>Thinking...</span>
                    </div>
                  ) : message.status === "cancelled" ? (
                    <span className="italic text-muted-foreground">
                      Request cancelled
                    </span>
                  ) : (
                    <MessageResponse>{message.content}</MessageResponse>
                  )}
                  {message.role === "assistant" &&
                    message.status === "completed" &&
                    messageIndex ===
                      (conversationMessages?.length ?? 0) - 1 && (
                      <MessageActions>
                        <MessageAction
                          label="Copy"
                          onClick={() => {
                            navigator.clipboard.writeText(message.content);
                          }}
                        >
                          <CopyIcon className="size-3" />
                        </MessageAction>
                      </MessageActions>
                    )}
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="p-3">
          <PromptInput className="mt-2" onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                disabled={isProcessing}
                placeholder="Ask Polaris anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputSubmit
                disabled={isProcessing ? false : !input}
                status={isProcessing ? "streaming" : undefined}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </>
  );
};

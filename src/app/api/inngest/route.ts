import { serve } from "inngest/next";

import { processMessage } from "@/features/conversations/inngest/process-message";
import { inngest } from "@/inngest/client";
import { demoError, demoGenerateText } from "@/inngest/functions";

// Create an API that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [demoError, demoGenerateText, processMessage],
});

import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { firecrawl } from "@/lib/firecrawl";

import { inngest } from "./client";

export const demoError = inngest.createFunction(
  { id: "demo-error" },
  { event: "demo/error" },
  async ({ step }) => {
    await step.run("fail", async () => {
      throw new Error("Inngest Error: Background job failed!");
    });
  }
);

const URL_REGEX = /https?:\/\/[^\s]+/g;

export const demoGenerateText = inngest.createFunction(
  { id: "demo-generate-text" },
  { event: "demo/generate-text" },
  async ({ event, step }) => {
    const { prompt } = event.data as { prompt: string };

    const urls = (await step.run("extract-urls", async () => {
      return prompt.match(URL_REGEX) ?? [];
    })) as string[];

    const scrappedContent = await step.run("scrape-urls", async () => {
      const results = await Promise.all(
        urls.map(async (url) => {
          const response = await firecrawl.scrape(url, {
            formats: ["markdown"],
          });
          return response.markdown ?? null;
        })
      );
      return results.filter(Boolean).join("\n\n");
    });

    const finalPrompt = scrappedContent
      ? `Context:\n${scrappedContent}\n\nQuestion: ${prompt}`
      : prompt;

    await step.run("generate-text", async () => {
      return await generateText({
        model: google("gemini-2.5-flash"),
        prompt: finalPrompt,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
        },
      });
    });
  }
);

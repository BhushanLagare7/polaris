import { NextResponse } from "next/server";

import { generateText, Output } from "ai";
import * as z from "zod";
import { google } from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";

import { firecrawl } from "@/lib/firecrawl";

const quickEditSchema = z.object({
  editedCode: z
    .string()
    .describe(
      "The edited version of the selected code based on the instruction"
    ),
});

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

const QUICK_EDIT_PROMPT = `You are an expert code editing assistant. Your task is to rewrite a specific selection of code based strictly on the user's instruction.

### Context & inputs
**Full File Context:**
{fullCode}

**Selected Code to Edit:**
{selectedCode}

**Relevant Documentation:**
{documentation}

### User Instruction
{instruction}

### Strict Guidelines
1. **Output Only Code:** Return *only* the edited code string. Do not use Markdown code blocks (no \`\`\`), do not provide explanations, and do not add conversational text.
2. **Indentation:** You must maintain the exact indentation level of the original "Selected Code".
3. **Safety:** If the instruction is unclear or cannot be applied to the selection, return the "Selected Code" exactly as is.
`;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { selectedCode, fullCode, instruction } = await request.json();

    if (!selectedCode || !fullCode || !instruction) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const urls: string[] = instruction.match(URL_REGEX) || [];
    let documentation = "";
    if (urls.length > 0) {
      const scrappedResults = await Promise.all(
        urls.map(async (url) => {
          try {
            const scrappedResult = await firecrawl.scrape(url, {
              formats: ["markdown"],
            });
            return scrappedResult.markdown;
          } catch (error) {
            console.error("Error scrapped url:", error);
            return "";
          }
        })
      );

      const validResults = scrappedResults.filter(Boolean);

      if (validResults.length > 0) {
        documentation = validResults.join("\n\n");
      }
    }

    const prompt = QUICK_EDIT_PROMPT.replace("{fullCode}", fullCode)
      .replace("{selectedCode}", selectedCode)
      .replace("{instruction}", instruction)
      .replace("{documentation}", documentation);

    const { output } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      output: Output.object({ schema: quickEditSchema }),
      prompt,
    });

    return NextResponse.json({ editedCode: output.editedCode });
  } catch (error) {
    console.error("Error generating code edit:", error);
    return NextResponse.json(
      { error: "Failed to generate code edit" },
      { status: 500 }
    );
  }
}

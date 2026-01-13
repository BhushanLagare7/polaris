import { NextResponse } from "next/server";

import { generateText, Output } from "ai";
import * as z from "zod";
import { google } from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";

const suggestionSchema = z.object({
  suggestion: z
    .string()
    .describe(
      "The code to insert at cursor, or empty string if no completion needed"
    ),
});

const SUGGESTION_PROMPT = `You are an expert code completion assistant powered by Gemini. Your task is to complete code based on the provided context.

*** CONTEXT DATA ***
File Name: {fileName}

<FULL_CODE_CONTEXT>
{code}
</FULL_CODE_CONTEXT>

<CURSOR_CONTEXT>
The cursor is located exactly between the PRE_CURSOR and POST_CURSOR blocks below.

[PRE_CURSOR]
{textBeforeCursor}
[/PRE_CURSOR]

[POST_CURSOR]
{textAfterCursor}
[/POST_CURSOR]
</CURSOR_CONTEXT>

<SURROUNDING_LINES>
Previous Lines:
{previousLines}

Current Line (Line {lineNumber}):
{currentLine}

Next Lines:
{nextLines}
</SURROUNDING_LINES>

*** INSTRUCTIONS ***
Analyze the context above and follow these rules strictly:

1. **Redundancy Check**: Examine the [POST_CURSOR] and "Next Lines" content. If the code immediately following the cursor effectively completes the thought or statement started in [PRE_CURSOR], do not generate text. Output an empty string.

2. **Completeness Check**: Examine the end of [PRE_CURSOR]. If it ends with a statement terminator (like ';', '}', or ')') and there is no indication (like a newline or partial word) that a new statement is beginning, do not generate text. Output an empty string.

3. **Generation**: If the above checks pass, generate the code required to bridge the gap between [PRE_CURSOR] and [POST_CURSOR].
   - Use the style and indentation found in <FULL_CODE_CONTEXT>.
   - Only generate the missing code.
   - Do NOT repeat code found in [POST_CURSOR].

*** OUTPUT FORMAT ***
- Return ONLY the code string.
- Do NOT use Markdown blocks (no \`\`\`).
- If no code is needed, return an empty string.`;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      fileName,
      code,
      textBeforeCursor,
      textAfterCursor,
      previousLines,
      currentLine,
      nextLines,
      lineNumber,
    } = await request.json();

    if (!code || lineNumber === undefined || lineNumber === null) {
      return NextResponse.json(
        { error: "Code and lineNumber are required" },
        { status: 400 }
      );
    }

    const prompt = SUGGESTION_PROMPT.replace("{fileName}", fileName)
      .replace("{code}", code)
      .replace("{textBeforeCursor}", textBeforeCursor)
      .replace("{textAfterCursor}", textAfterCursor)
      .replace("{previousLines}", previousLines || "")
      .replace("{currentLine}", currentLine)
      .replace("{nextLines}", nextLines || "")
      .replace("{lineNumber}", lineNumber.toString());

    const { output } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      output: Output.object({ schema: suggestionSchema }),
      prompt,
    });

    return NextResponse.json({ suggestion: output.suggestion });
  } catch (error) {
    console.error("Error generating code suggestion:", error);
    return NextResponse.json(
      { error: "Failed to generate code suggestion" },
      { status: 500 }
    );
  }
}

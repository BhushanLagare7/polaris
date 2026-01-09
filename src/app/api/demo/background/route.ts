import { inngest } from "@/inngest/client";

export async function POST() {
  await inngest.send({ name: "demo/generate-text", data: {} });

  return Response.json({ status: "started" });
}

import { Inngest } from "inngest";
import { sentryMiddleware } from "@inngest/middleware-sentry";

// CREATE A CLIENT TO SEND AND RECEIVE EVENTS
// INNGEST IS USED FOR
export const inngest = new Inngest({
  id: "polaris",
  middleware: [sentryMiddleware()],
});

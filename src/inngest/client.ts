import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "receipt-parsing-pipeline",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

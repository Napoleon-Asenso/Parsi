import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { parseReceiptFunction } from "@/inngest/functions/parseReceipt";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [parseReceiptFunction],
});

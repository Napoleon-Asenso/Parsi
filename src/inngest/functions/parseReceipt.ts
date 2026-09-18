import { inngest } from "../client";
import {
  AI_CONFIG,
  DOCUMENT_PARSING_SYSTEM_PROMPT,
  ParsedDocumentSchema,
} from "@/config/ai.config";
import { db } from "@/lib/db";
import { verifyS3ObjectExists, getS3ObjectBuffer } from "@/lib/s3";
import { extractDocument, ExtractionError } from "@/lib/extract";
import { NonRetriableError } from "inngest";
import OpenAI from "openai";

export interface ParseReceiptEventData {
  jobId: string;
  storageKey: string;
  mimeType: string;
  fileName?: string;
  forceFailure?: boolean;
}

export const parseReceiptFunction = inngest.createFunction(
  {
    id: "parse-receipt",
    concurrency: { limit: AI_CONFIG.concurrencyLimit },
    retries: AI_CONFIG.parsing.maxRetries,
  },
  { event: "expense/job.created" },
  async ({ event, step }) => {
    const { jobId, storageKey, mimeType, fileName, forceFailure } =
      event.data as ParseReceiptEventData;

    try {
      // Step 1: Mark Job as PROCESSING and increment attempts counter
      const storedFileName = await step.run("mark-job-processing", async () => {
        const updatedJob = await db.job.update({
          where: { id: jobId },
          data: {
            status: "PROCESSING",
            attempts: { increment: 1 },
          },
          include: { file: true },
        });
        return updatedJob.file.fileName;
      });

      // Step 2: Verify S3 object exists using HeadObjectCommand
      await step.run("verify-s3-object", async () => {
        const exists = await verifyS3ObjectExists(storageKey);
        if (!exists) {
          throw new NonRetriableError(`S3 object not found for storageKey: ${storageKey}`);
        }
      });

      // Step 3: Extract readable content from ANY accepted file format.
      // Images stay as images; PDFs/text/markdown/Word are turned into text.
      const payload = await step.run("prepare-document-payload", async () => {
        const fileBuffer = await getS3ObjectBuffer(storageKey);
        const documentName = fileName || storedFileName;

        try {
          return await extractDocument(fileBuffer, mimeType, documentName);
        } catch (extractErr) {
          if (extractErr instanceof ExtractionError) {
            throw new NonRetriableError(extractErr.message);
          }
          throw extractErr;
        }
      });

      // Step 4: Invoke OpenAI Chat Completions API
      const rawAiOutput = await step.run("call-openai-vision", async () => {
        if (forceFailure) {
          // If forced failure test flag is on, return invalid JSON payload immediately
          return JSON.stringify({
            merchantName: "Forced Failure Test",
            totalAmount: "INVALID_NUMBER_STRING",
          });
        }

        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          timeout: AI_CONFIG.parsing.timeoutMs,
        });

        const instruction = payload.text
          ? "Transcribe the following document in full and extract its structured expense data (when present) into the required JSON schema."
          : "Transcribe the attached document image(s) in full and extract their structured expense data (when present) into the required JSON schema.";

        const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          {
            type: "text",
            text: payload.text ? `${instruction}\n\n<document>\n${payload.text}\n</document>` : instruction,
          },
        ];

        for (const image of payload.images) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: `data:${image.mimeType};base64,${image.base64}`,
              detail: AI_CONFIG.parsing.detailLevel,
            },
          });
        }

        const completion = await openai.chat.completions.create({
          model: AI_CONFIG.parsing.model,
          temperature: AI_CONFIG.parsing.temperature,
          max_tokens: AI_CONFIG.parsing.maxTokens,
          messages: [
            {
              role: "system",
              content: DOCUMENT_PARSING_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: userContent,
            },
          ],
        });

        const choice = completion.choices?.[0];
        if (!choice) {
          throw new NonRetriableError("OpenAI returned an empty choice list");
        }

        if (choice.finish_reason !== "stop") {
          throw new NonRetriableError(
            `OpenAI output was truncated. finish_reason was: ${choice.finish_reason}`
          );
        }

        return choice.message.content || "";
      });

      // Step 5: Validate Zod schema & update PostgreSQL database
      await step.run("validate-and-save", async () => {
        let parsedJson: unknown;
        try {
          // Strip Markdown code block wrappers
          const cleanedText = rawAiOutput.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
          parsedJson = JSON.parse(cleanedText);
        } catch (jsonErr) {
          const errMessage = `JSON parse error: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`;
          await db.job.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              errorMessage: errMessage,
            },
          });
          throw new NonRetriableError(errMessage);
        }

        const parseResult = ParsedDocumentSchema.safeParse(parsedJson);
        if (!parseResult.success) {
          const formattedError = JSON.stringify(parseResult.error.format());
          await db.job.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              errorMessage: `Zod validation failure: ${formattedError}`,
            },
          });
          throw new NonRetriableError(`Zod schema validation failed: ${formattedError}`);
        }

        // Schema validation succeeded - persist to Job record
        await db.job.update({
          where: { id: jobId },
          data: {
            status: "DONE",
            resultJson: parseResult.data as object,
            errorMessage: null,
          },
        });
      });

      return { success: true, jobId };
    } catch (err: unknown) {
      // Ensure failure status and error details are recorded on unrecoverable failure
      const errorText = err instanceof Error ? err.message : String(err);
      try {
        await db.job.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            errorMessage: errorText,
          },
        });
      } catch (dbErr) {
        console.error("Failed to update job status to FAILED:", dbErr);
      }
      throw err;
    }
  }
);

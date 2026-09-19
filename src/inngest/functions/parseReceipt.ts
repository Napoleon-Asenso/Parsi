import { inngest } from "../client";
import {
  AI_CONFIG,
  GEMINI_CONFIG,
  DOCUMENT_PARSING_SYSTEM_PROMPT,
  ParsedDocumentSchema,
} from "@/config/ai.config";
import { db } from "@/lib/db";
import { verifyObjectExists, getObjectBuffer } from "@/lib/r2";
import { extractDocument, ExtractionError } from "@/lib/extract";
import { NonRetriableError } from "inngest";
import { GoogleGenAI } from "@google/genai";
import type { Part } from "@google/genai";

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

      // Step 2: Verify R2 object exists using HeadObjectCommand
      await step.run("verify-r2-object", async () => {
        const exists = await verifyObjectExists(storageKey);
        if (!exists) {
          throw new NonRetriableError(`R2 object not found for storageKey: ${storageKey}`);
        }
      });

      // Step 3: Extract readable content from ANY accepted file format.
      // Images stay as images; PDFs/text/markdown/Word are turned into text.
      const payload = await step.run("prepare-document-payload", async () => {
        const fileBuffer = await getObjectBuffer(storageKey);
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

      // Step 4: Invoke Google Gemini (free tier) Chat + Vision API
      const rawAiOutput = await step.run("call-gemini-vision", async () => {
        if (forceFailure) {
          // If forced failure test flag is on, return invalid JSON payload immediately
          return JSON.stringify({
            merchantName: "Forced Failure Test",
            totalAmount: "INVALID_NUMBER_STRING",
          });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const instruction = payload.text
          ? "Transcribe the following document in full and extract its structured expense data (when present) into the required JSON schema."
          : "Transcribe the attached document image(s) in full and extract their structured expense data (when present) into the required JSON schema.";

        const parts: Part[] = [
          {
            text: payload.text
              ? `${instruction}\n\n<document>\n${payload.text}\n</document>`
              : instruction,
          },
        ];

        for (const image of payload.images) {
          parts.push({
            inlineData: {
              mimeType: image.mimeType,
              data: image.base64,
            },
          });
        }

        const response = await ai.models.generateContent({
          model: GEMINI_CONFIG.parsing.model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: DOCUMENT_PARSING_SYSTEM_PROMPT,
            temperature: GEMINI_CONFIG.parsing.temperature,
            maxOutputTokens: GEMINI_CONFIG.parsing.maxOutputTokens,
          },
        });

        const candidate = response.candidates?.[0];
        if (!candidate) {
          throw new NonRetriableError("Gemini returned an empty candidate list");
        }

        if (candidate.finishReason && candidate.finishReason !== "STOP") {
          throw new NonRetriableError(
            `Gemini output was truncated. finishReason was: ${candidate.finishReason}`
          );
        }

        return response.text || "";
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

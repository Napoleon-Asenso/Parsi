---
trigger: glob
---

---

name: ai-pipeline-and-queue
description: Enforce Inngest background queue processing, strict step isolation, concurrency caps for rate limits, central AI config sourcing, runtime Zod validation, and structured error persistence.
version: 1.0.0

---

# Operational Directives: AI Pipeline & Inngest Queue Execution

## 1. Concurrency Control & Rate Limiting

- **Hard Concurrency Cap:** The Inngest background worker MUST set `concurrency: { limit: AI_CONFIG.concurrencyLimit }` (3 parallel executions) inside the function definition to prevent OpenAI API rate limit exceptions[cite: 2].
- **Central Config Sourcing:** Import all concurrency settings, model names, temperatures, and token caps directly from `src/config/ai.config.ts`[cite: 2]. Inline overrides inside the queue handler are forbidden[cite: 2].

## 2. Inngest Event Configuration

- **Event Trigger:** Listen exclusively for the Inngest event `expense/job.created`[cite: 2].
- **Route Export Location:** Export the handler from `src/app/api/inngest/route.ts` using `serve({ client: inngest, functions: [parseReceiptFunction] })`[cite: 2].

## 3. Step-Isolated Queue Processing Workflow

All queue execution steps MUST be wrapped individually in `step.run` blocks to ensure atomic execution and clean retry boundaries[cite: 2]:

1. **Step 1: Mark Job as PROCESSING**
   - Update `Job.status` from `PENDING` to `PROCESSING` in PostgreSQL[cite: 2].
   - Increment `Job.attempts` counter by 1[cite: 2].

2. **Step 2: S3 Object Verification**
   - Perform a `HeadObjectCommand` against S3 using the provided `storageKey`[cite: 2].
   - If the object does not exist, throw a `NonRetriableError` to cancel the background execution immediately[cite: 2].

3. **Step 3: Document Buffer Preparation**
   - Download the file object from S3.
   - If `mimeType === "application/pdf"`, convert Page 1 ONLY into an image buffer (PNG/JPEG)[cite: 2]. Ignore all subsequent pages[cite: 2].

4. **Step 4: Execute Document Extraction (Task 1)**
   - Invoke `openai.chat.completions.create` using the system prompt and configuration settings from `src/config/ai.config.ts` (`model: "gpt-4o-mini"`, `temperature: 0.2`)[cite: 2].
   - Verify `completion.choices[0].finish_reason === "stop"`[cite: 2]. If `finish_reason` is `"length"` or `"content_filter"`, throw a `NonRetriableError`[cite: 2].

5. **Step 5: Zod Schema Validation & DB Persistence**
   - Strip Markdown code fences (` ```json ... ``` `) from the response content.
   - Pass sanitized JSON to `ParsedReceiptSchema.parse()`[cite: 2].
   - Update `Job.resultJson` with the valid parsed object and transition `Job.status` to `DONE`[cite: 2].

## 4. Forced Schema Failure Testing Flag

- To enable assessment testing, inspect headers for `X-Test-Force-Failure: true` in development mode (`process.env.NODE_ENV === "development"`)[cite: 2].
- When this flag is set, inject an invalid payload into the validator to intentionally trigger a schema failure, transitioning `Job.status` to `FAILED` and logging the error to `Job.errorMessage`[cite: 2].

## 5. Retry Rules & Error Logging

- **Transient Failures:** Allow up to `AI_CONFIG.parsing.maxRetries` (2 retries) for network glitches or OpenAI 5xx errors[cite: 2].
- **Unrecoverable Failures:** Throw `NonRetriableError` for missing S3 files, invalid MIME types, truncated outputs, or Zod validation errors[cite: 2].
- **Error Recording:** On unrecoverable failure or exhausted retries, update `Job.status = "FAILED"` in PostgreSQL, store the error string in `Job.errorMessage`, and log the failure details[cite: 2].

---
name: validate-schema-runtime
description: Enforce strict runtime Zod validation on AI model outputs, handle code fence stripping, manage schema retry logic, and log diagnostic failures.
version: 1.0.0
---

# Operational Directives: Runtime Schema Validation

## 1. Schema Definition & Export Mandate

- **Single Source Schema:** Export all document parsing schemas exclusively from `src/config/ai.config.ts`[cite: 2].
- **Schema Contracts:**
  - `LineItemSchema`: Standardizes itemized receipt rows (`description`, `quantity`, `unitPrice`, `totalPrice`)[cite: 2].
  - `ParsedReceiptSchema`: Standardizes top-level financial metrics (`merchantName`, `transactionDate`, `totalAmount`, `taxAmount`, `currency`, `category`, `lineItems`)[cite: 2].

## 2. Pre-Parsing Sanitization Rules

Before passing raw LLM text into Zod validation, you MUST execute the following sanitization sequence[cite: 2]:

1. Verify `completion.choices[0].finish_reason === "stop"`[cite: 2]. If `finish_reason` is `"length"` or `"content_filter"`, throw an unretriable schema validation exception immediately[cite: 2].
2. Strip markdown code block wrappers (e.g., `json ... ` or `...`) using `rawText.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()`.
3. Parse sanitized string with `JSON.parse()`.

## 3. Strict Runtime Execution & Failure Logging

- **Validation Execution:** Pass the parsed object into `ParsedReceiptSchema.parse(parsedJson)`[cite: 2].
- **Database Persistence Rule:** NEVER update `Job.status` to `DONE` or write to `Job.resultJson` without passing Zod validation[cite: 2].
- **Validation Error Handling:** If Zod validation throws a `ZodError`:
  1. Do NOT execute automatic AI prompt re-tries if fields are fundamentally invalid[cite: 2].
  2. Format the error using `zodError.format()` or `zodError.errors`.
  3. Update `Job.status = "FAILED"` in PostgreSQL[cite: 2].
  4. Persist formatted error message into `Job.errorMessage`[cite: 2].

## 4. Forced Schema Failure Testing Flag

To support assessment grading, the processing pipeline MUST inspect HTTP headers when creating jobs in `development` mode (`process.env.NODE_ENV === "development"`)[cite: 2]:

- If header `X-Test-Force-Failure: true` is present on `POST /api/jobs`, inject invalid payload data (e.g., `{ totalAmount: "INVALID_NUMBER" }`) directly into the Zod validator to force a deterministic validation crash, verifying transition to `FAILED` status and populating `Job.errorMessage`[cite: 2].

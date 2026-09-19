# AGENTS.md: Operational Rulebook for AI Coding Agents

**Project Identity:** Assessment 3: The AI Integration Slice (Receipt & Document Parsing Pipeline)  
**Primary Domain:** Receipt and Document Parsing to Structured Expense Data  
**Source of Truth:** `PRD.md`

---

## 1. System & Scope Overview

You are an automated software engineering agent operating within the Antigravity development environment. Your sole responsibility is to implement "Assessment 3: The AI Integration Slice" exactly as specified in `PRD.md`.

- **Core Mission:** Construct an asynchronous document processing pipeline that transforms uploaded receipts/invoices (JPEG, PNG, single-page PDF) into Zod-validated structured JSON and allows a single follow-up executive summary action.
- **Binding Authority:** `PRD.md` is the single source of truth. You MUST NOT add routes, features, options, dependencies, or architectural abstractions that are not explicitly authorized by the PRD or this rulebook.
- **Zero-Tolerance Criteria:** If a feature works visually or functionally but violates a directive in this file (e.g., inline LLM parameters, multi-file handling, missing Zod validation, binary files in PostgreSQL), the implementation is an **ABSOLUTE FAILURE**.

---

## 2. Locked Technology Stack

You are strictly prohibited from adding, swapping, or removing core technology dependencies. The stack is locked as follows:

| Layer | Approved Technology |
| :--- | :--- |
| **Framework** | Next.js (App Router, Node.js runtime) |
| **Language** | TypeScript (Strict mode enabled) |
| **Database & ORM** | PostgreSQL with Prisma ORM |
| **Background Queue** | Inngest (Event-driven background workers) |
| **AI SDK** | Official OpenAI Node SDK (`openai`) targeting model `gpt-4o-mini` |
| **File Storage** | Cloudflare R2 (S3-compatible) object storage via Presigned URLs |
| **Validation** | Zod (`z.infer`, `z.coerce`, strict runtime validation) |

*Rule:* Do NOT install secondary ORMs (e.g., Drizzle, TypeORM), alternate AI SDKs (e.g., Vercel AI SDK, LangChain), alternate queue managers (e.g., BullMQ, Redis), or state machines[cite: 2].

---

## 3. Non-Negotiable "Do Not Build" & Guardrail Rules

Violation of any rule below constitutes an immediate task rejection:

1. **NEVER Write Binary Data to PostgreSQL:** You MUST NOT store raw files, base64 strings, or file buffers in PostgreSQL[cite: 2]. Store Cloudflare R2 `storage_key` strings only in the `files` table[cite: 2].
2. **NEVER Inline Model Parameters:** Do NOT write inline model names, temperatures, max token limits, or retry limits inside Next.js API routes, Server Actions, or Inngest background functions[cite: 2]. ALL AI parameters MUST be imported directly from `src/config/ai.config.ts`[cite: 2].
3. **NEVER Commit API Keys or Credentials:** Do NOT hardcode secrets, R2 keys, or AI tokens[cite: 2]. Retrieve all credentials via standard `process.env` lookups[cite: 2].
4. **NEVER Violate the 3-Screen Boundary:** The application MUST contain strictly 3 UI views:
   - Screen 1: Upload View (`/`)[cite: 2]
   - Screen 2: Processing View (`/jobs/[id]` - PENDING/PROCESSING state)[cite: 2]
   - Screen 3: Result View (`/jobs/[id]` - DONE state)[cite: 2]
   *Do NOT build landing pages, homepages, marketing views, settings pages, or secondary dashboards[cite: 2].*
5. **NEVER Implement Multi-File or Bulk Processing:** Do NOT build drag-and-drop queues for multiple files, bulk editors, or batch uploads[cite: 2]. Direct client uploads and background queues must process single files sequentially per job[cite: 2].
6. **NEVER Implement Export or Sharing Features:** Do NOT build CSV exports, PDF download generation, email triggers, or public sharing links[cite: 2].
7. **NEVER Bypass Zod Runtime Validation:** Unvalidated OpenAI JSON outputs MUST NEVER be written directly to `Job.resultJson` or set to status `DONE`[cite: 2]. Raw responses must pass `ParsedReceiptSchema.parse()` first[cite: 2].
8. **NEVER Allow Multi-Page PDF Pipelines:** PDFs MUST be restricted or converted to Page 1 only prior to sending to OpenAI[cite: 2]. Subsequent pages MUST be ignored[cite: 2].

---

## 4. Project File Layout & Directory Structure

You must strictly conform to the following directory layout[cite: 2]. Do not invent unapproved directories[cite: 2].

```text
├── prisma/
│   └── schema.prisma             # Exact Prisma ORM models and indexes
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/
│   │   │   ├── jobs/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── route.ts       # GET: Fetch job status & resultJson
│   │   │   │   │   └── summarize/
│   │   │   │   │       └── route.ts   # POST: Trigger/fetch Task 2 summary
│   │   │   │   └── route.ts           # POST: Create job record & emit Inngest event
│   │   │   ├── inngest/
│   │   │   │   └── route.ts           # Inngest API endpoint handler
│   │   │   └── upload/
│   │   │       └── presigned-url/
│   │   │           └── route.ts       # POST: Validate payload & generate R2 presigned PUT URL
│   │   ├── jobs/
│   │   │   └── [id]/
│   │   │       └── page.tsx           # Dynamic View: Screen 2 (Processing) & Screen 3 (Result)
│   │   ├── layout.tsx                 # Root application layout
│   │   └── page.tsx                   # Screen 1: Upload View Dropzone
│   ├── components/                # React UI Components for the 3 screens
│   │   ├── ProcessingView.tsx     # Screen 2 polling & progress UI
│   │   ├── ResultView.tsx         # Screen 3 structured fields & line items table
│   │   ├── SummaryModal.tsx       # Screen 3 follow-up summary drawer/modal
│   │   └── UploadDropzone.tsx     # Screen 1 drag-and-drop dropzone
│   ├── config/
│   │   └── ai.config.ts           # CENTRAL MANDATE: OpenAI config, Zod schemas, types
│   ├── inngest/
│   │   ├── client.ts              # Inngest client initialization
│   │   └── functions/
│   │       └── parseReceipt.ts    # Background queue worker with concurrency = 3
│   └── lib/
│       ├── db.ts                  # Instantiated Prisma Client singleton
│       ├── r2.ts                   # Cloudflare R2 client and presigned URL helpers
│       └── utils.ts               # Shared utility functions
├── .env.example
├── PRD.md                         # Single source of truth
└── package.json
5. Code Style, TypeScript, & Safety DirectivesA. Central Config Mandate (src/config/ai.config.ts)You MUST structure src/config/ai.config.ts as the single source for configuration and Zod schemas[cite: 2]:TypeScriptimport { z } from "zod";

export const AI_CONFIG = {
  parsing: {
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 1500,
    timeoutMs: 30000,
    maxRetries: 2,
    detailLevel: "low" as const,
  },
  summarization: {
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 500,
    timeoutMs: 15000,
  },
  concurrencyLimit: 3,
} as const;

export const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().nullable().default(1),
  unitPrice: z.coerce.number().nullable().default(null),
  totalPrice: z.coerce.number().nonnegative(),
});

export const ParsedReceiptSchema = z.object({
  merchantName: z.string().default("Unknown Merchant"),
  transactionDate: z.string().nullable().default(null),
  totalAmount: z.coerce.number().nonnegative(),
  taxAmount: z.coerce.number().nullable().default(null),
  currency: z.string().default("USD"),
  category: z.string().default("General"),
  lineItems: z.array(LineItemSchema).default([]),
});

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;
B. Inngest Function Concurrency & Step IsolationBackground functions MUST enforce step isolation and a concurrency cap of 3[cite: 2]:TypeScriptimport { inngest } from "../client";
import { AI_CONFIG, ParsedReceiptSchema } from "@/config/ai.config";
import { NonRetriableError } from "inngest";

export const parseReceiptFunction = inngest.createFunction(
  {
    id: "parse-receipt",
    concurrency: { limit: AI_CONFIG.concurrencyLimit },
    retries: AI_CONFIG.parsing.maxRetries,
  },
  { event: "expense/job.created" },
  async ({ event, step }) => {
    // Step 1: Mark Job as PROCESSING and increment attempts counter
    await step.run("mark-job-processing", async () => { ... });

    // Step 2: Verify R2 object exists using HeadObjectCommand
    await step.run("verify-r2-object", async () => { ... });

    // Step 3: Fetch object or convert single-page PDF to PNG buffer
    const imagePayload = await step.run("prepare-document-payload", async () => { ... });

    // Step 4: Invoke OpenAI Chat Completions API
    const rawAiOutput = await step.run("call-openai-vision", async () => { ... });

    // Step 5: Validate Zod schema & update PostgreSQL database
    await step.run("validate-and-save", async () => { ... });
  }
);
C. Forced Failure Testing FlagTo support assessment verification, /api/jobs MUST check for the header X-Test-Force-Failure: true in development mode (process.env.NODE_ENV === "development")[cite: 2]. When present, the background job MUST deliberately inject malformed data into the Zod validator to verify that the job gracefully transitions to status FAILED and persists an explicit log message to Job.errorMessage[cite: 2].6. Definition of Done (DoD) ChecklistBefore marking any implementation task as complete, you MUST execute and pass every item on this checklist:[ ] Type-Check Safety: Run npx tsc --noEmit and ensure ZERO TypeScript errors exist[cite: 2].[ ] Production Build Validation: Run npm run build and confirm Next.js compiles all routes (/, /jobs/[id], API routes) without warnings or errors[cite: 2].[ ] Prisma Schema Consistency: Run npx prisma validate and verify prisma/schema.prisma strictly matches the PRD structure (including Job.summaryText, composite index @@index([userId, status]), and @unique on File.storageKey)[cite: 2].[ ] S3 Signature Constraints: Verify /api/upload/presigned-url enforces server-side Zod validation on file size ($\le 10\text{ MB}$) and MIME types (image/jpeg, image/png, application/pdf) before generating S3 signatures[cite: 2].[ ] Task 2 Caching: Confirm POST /api/jobs/[id]/summarize checks Job.summaryText first and skips calling OpenAI if a summary is already present[cite: 2].[ ] No Raw Files in DB: Verify via database inspection that the files table contains only AWS S3 storage keys and zero binary/base64 representations[cite: 2].[ ] Strict Scope Adherence: Confirm that NO secondary routes, landing pages, or multi-file controls were built[cite: 2].7. Ambiguity & Exception Handling ("When Unsure")When encountering ambiguous requirements or unexpected runtime errors, follow these explicit rules:Pause and Declare Assumptions: State your exact technical assumption clearly before generating code. Tag all assumptions with [ASSUMPTION][cite: 2].Never Expand Scope: If a user request or edge case implies adding extra screens, dashboards, batch tools, or exporters, REJECT IT IMMEDIATELY[cite: 2]. Quote Section 3 ("Do Not Build") of PRD.md as the reason[cite: 2].Prefer Explicit Failure over Fallback Guessing: If OpenAI returns incomplete JSON or an invalid field structure, do NOT guess missing values[cite: 2]. Throw an explicit Zod validation error, transition Job.status to FAILED, record the diagnostic error in Job.errorMessage, and present clean diagnostic UI feedback[cite: 2].
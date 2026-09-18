# Product Requirements Document (PRD)

## Assessment 3: The AI Integration Slice (Receipt & Document Parsing Pipeline)

**Domain:** Receipt/Document Parsing to Structured Expense Data[cite: 2]  
**Framework:** Next.js (App Router)[cite: 2]  
**Language:** TypeScript[cite: 2]  
**Database & ORM:** PostgreSQL (Prisma ORM)[cite: 2]  
**Queue & Concurrency:** Inngest[cite: 2]  
**AI SDK:** Official OpenAI Node SDK (`openai`) using `gpt-4o-mini`[cite: 2]  
**File Storage:** S3 / S3-Compatible via Presigned URLs[cite: 2]  
**Schema Validation:** Zod[cite: 2]

---

### 1. Product Summary

The AI Integration Slice provides an asynchronous receipt and invoice parsing pipeline that transforms raw document uploads into validated, structured expense data[cite: 2]. Users upload an expense document via presigned URLs, witness real-time processing status updates, view extracted itemized details, and trigger a contextual executive summary[cite: 2].

---

### 2. Problem Statement

Manual entry of receipts introduces accounting errors and friction[cite: 2]. Standard OCR approaches yield unstructured text requiring manual re-keying[cite: 2]. This product eliminates manual entry by parsing raw document uploads into strict, validated JSON schemas asynchronously while maintaining system stability and strict API rate limits[cite: 2].

---

### 3. Goals & Non-Goals

#### Goals

- Direct client-to-S3 upload bypassing application server bandwidth limits[cite: 2].
- Immediate background job offloading returning HTTP 202 Accepted[cite: 2].
- Structured data extraction using strict Zod runtime schema validation[cite: 2].
- Throttled background queue processing enforcing a concurrency cap of 3 to respect OpenAI rate limits[cite: 2].
- Clear state transitions (`PENDING` → `PROCESSING` → `DONE` / `FAILED`)[cite: 2].
- Server-side conversion of single-page PDFs to image buffers before AI processing[cite: 2].

#### Non-Goals ("Do Not Build")

- **No Multi-File Bulk Editors:** Single-file upload processing per stream only[cite: 2].
- **No Multi-Page PDF Processing:** PDFs exceeding 1 page will have only Page 1 converted and processed; subsequent pages are ignored[cite: 2].
- **No Sharing or Exporting:** No PDF generation, CSV exports, or email sharing[cite: 2].
- **No Secondary Landing Pages:** No marketing homepages or extraneous dashboards[cite: 2].
- **No Raw File Database Storage:** Store S3 storage keys only[cite: 2].
- **No Inline Model Configuration:** OpenAI parameters must live in the central config file (`src/config/ai.config.ts`)[cite: 2].
- **No Currency Conversion:** Extracted amounts retain original numeric values and source currency codes[cite: 2].

---

### 4. User Personas & Core User Journeys

#### Persona

- **Alex (Freelance Developer / Small Business Owner):** Needs to process receipts quickly without manual copy-pasting and requires immediate feedback if a document cannot be parsed[cite: 2].

#### Core User Journey

1. **Upload (Screen 1):** Alex drops a single receipt onto the upload dropzone on Screen 1[cite: 2]. The client calls `/api/upload/presigned-url` with validated file parameters, pushes the file directly to S3, posts metadata to `/api/jobs`, and receives a `jobId`[cite: 2].
2. **Processing (Screen 2):** Alex is routed immediately to Screen 2 (`/jobs/[id]`), where polling tracks status (`PENDING` → `PROCESSING`)[cite: 2]. In the background, the worker executes S3 object verification via `HeadObjectCommand` before calling OpenAI[cite: 2].
3. **Review & Action (Screen 3):** Upon job completion, Screen 2 dynamically renders Screen 3 state (`DONE`)[cite: 2]. Alex reviews extracted fields (merchant, date, total, tax, line items) and clicks "Summarize Expense"[cite: 2]. The summary is generated, returned, and cached in the database[cite: 2].

---

### 5. Functional Requirements

#### Screen 1: Upload View (`/`)

- Drag-and-drop file dropzone supporting `image/jpeg`, `image/png`, and `application/pdf`[cite: 2].
- Client-side validation enforcing file size caps ($\le 10\text{ MB}$)[cite: 2].
- **Flow:**
  1. `POST /api/upload/presigned-url` $\rightarrow$ receive `uploadUrl` & `storageKey`[cite: 2].
  2. `PUT` raw file payload directly to S3[cite: 2].
  3. `POST /api/jobs` with metadata $\rightarrow$ receive `jobId`[cite: 2].
  4. Client redirects immediately to `/jobs/[id]`[cite: 2].

#### Screen 2: Processing State View (`/jobs/[id]` - Pending/Processing State)

- Polling status mechanism targeting `GET /api/jobs/[id]` at a 2-second interval[cite: 2].
- Visual indicators showing active execution state (`PENDING` or `PROCESSING`)[cite: 2].
- **60-second client-side timeout:** if status remains non-terminal after 60s, UI transitions to a timeout error view offering an upload retry[cite: 2].
- Automatic dynamic view transition to Screen 3 upon state transition to `DONE`[cite: 2].
- Friendly failure state UI displaying actionable diagnostic feedback if status transitions to `FAILED`[cite: 2].

#### Screen 3: Result View & Follow-up Action (`/jobs/[id]` - Done State)

- **Side-by-side or stacked layout displaying extracted fields:**
  - **Header Details:** Merchant Name, Date, Total Amount, Currency, Tax Amount, Category[cite: 2].
  - **Line Items:** Itemized table displaying Description, Quantity, Unit Price, and Line Total[cite: 2].
- **Follow-up Action:** "Summarize Expense" button triggering `POST /api/jobs/[id]/summarize`[cite: 2]. The resulting textual summary is rendered in a drawer or modal and cached in `Job.summaryText`[cite: 2].
- **Reset Route:** "Upload Another Receipt" button routing back to Screen 1 (`/`)[cite: 2].

---

### 6. Technical Specifications & API Contracts

#### API Endpoints Table

| Endpoint                    | Method | Payload / Details                                                                       | Response                                                        |
| :-------------------------- | :----- | :-------------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| `/api/upload/presigned-url` | `POST` | `{ fileName: string, fileType: string, fileSize: number }`[cite: 2]                     | `200 OK`: `{ uploadUrl: string, storageKey: string }`[cite: 2]  |
| `/api/jobs`                 | `POST` | `{ storageKey: string, fileName: string, fileSize: number, mimeType: string }`[cite: 2] | `202 Accepted`: `{ jobId: string, status: "PENDING" }`[cite: 2] |
| `/api/jobs/[id]`            | `GET`  | N/A[cite: 2]                                                                            | `200 OK`: Full job record & `resultJson`[cite: 2]               |
| `/api/jobs/[id]/summarize`  | `POST` | N/A[cite: 2]                                                                            | `200 OK`: `{ summary: string }`[cite: 2]                        |

#### Central AI Configuration File (`src/config/ai.config.ts`)

````typescript
import { z } from "zod";

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
```[cite: 2]

---

### 7. System Prompts & Execution Rules

#### Task 1: Document Parsing Prompt
* **Model:** `gpt-4o-mini` | **Temperature:** 0.2 | **Max Tokens:** 1,500[cite: 2]

```text
SYSTEM PROMPT:
You are an expert financial document parser. Your sole task is to extract structured receipt and invoice data into strict JSON format matching the requested schema.

Guidelines:
1. Extract exact values from the document image or text provided.
2. If a value (e.g., taxAmount, line items) is not explicitly present, return null for optional fields or empty arrays for lists. Do not guess or fabricate values.
3. Dates must be output in ISO-8601 format (YYYY-MM-DD) when readable.
4. Amounts must be raw numeric floating-point values without currency symbols.
```[cite: 2]

* **Execution Constraints:** The background worker MUST inspect `completion.choices[0].finish_reason`[cite: 2]. If `finish_reason !== "stop"`, throw an unretriable error[cite: 2]. Strip any Markdown code fences (```json) prior to passing raw output into `ParsedReceiptSchema.parse()`[cite: 2].

#### Task 2: Follow-up Summarization Prompt
* **Model:** `gpt-4o-mini` | **Temperature:** 0.3 | **Max Tokens:** 500[cite: 2]

```text
SYSTEM PROMPT:
You are a senior accounting assistant. You will receive structured JSON representing an expense item. Provide a clear, two-sentence executive summary stating what was purchased, the total cost, and any notable accounting observations (e.g., missing tax data or high single-item expense).
```[cite: 2]

---

### 8. Prisma Data Model (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum JobStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  files     File[]
  jobs      Job[]

  @@map("users")
}

model File {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  storageKey String   @unique @map("storage_key")
  fileName   String   @map("file_name")
  fileSize   Int      @map("file_size")
  mimeType   String   @map("mime_type")
  createdAt  DateTime @default(now()) @map("created_at")
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobs       Job[]

  @@index([userId])
  @@map("files")
}

model Job {
  id           String    @id @default(uuid())
  userId       String    @map("user_id")
  fileId       String    @map("file_id")
  status       JobStatus @default(PENDING)
  attempts     Int       @default(0)
  errorMessage String?   @map("error_message")
  resultJson   Json?     @map("result_json")
  summaryText  String?   @map("summary_text")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  file         File      @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([fileId])
  @@map("jobs")
}
```[cite: 2]

---

### 9. Cost Model & Failure Modes

#### Estimated Cost Breakdown (Per Execution)
* Input Tokens (~1,000 text/vision): ~$0.00015[cite: 2]
* Output Tokens (~400 JSON): ~$0.00024[cite: 2]
* Storage & Queue Operations: ~$0.00001[cite: 2]
* **Total Cost per Execution:** ~$0.00040 USD[cite: 2]

#### Error Handling & Retry Policies
* **HTTP 429 & OpenAI 5xx Transients:** Retried via Inngest exponential backoff up to 2 times (`AI_CONFIG.parsing.maxRetries`)[cite: 2].
* **Unrecoverable Failures:** Missing S3 files, invalid file types, corrupted images, or non-stop token truncation throw `NonRetriableError` immediately[cite: 2].
* **Failure Persistence:** Updates `Job.status` to `FAILED`, logs internal error code to `Job.errorMessage`, and presents clean user feedback on Screen 2[cite: 2].

---

### 10. Key Success Metrics & Evidence Collection Plan
1. **Database Jobs Table Screenshot:** Proves state transitions (`PENDING` → `PROCESSING` → `DONE`/`FAILED`) alongside attempt counters[cite: 2].
2. **Raw File vs. Parsed JSON Comparison:** Visual side-by-side proof comparing uploaded document against rendered Zod-validated JSON output on Screen 3[cite: 2].
3. **Forced Schema Failure Record:** Verified in development mode by supplying header `X-Test-Force-Failure: true` to `/api/jobs`, confirming transition to `FAILED` and logging explicit schema error messages[cite: 2].
4. **Storage Key Verification:** Database dump proving the `files` table contains S3 object keys (e.g., `uploads/usr_123/rcpt_99.png`) without binary representations[cite: 2].

---

### 11. Stated Assumptions List
* **[ASSUMPTION]** S3 Presigned URLs expire after 15 minutes[cite: 2].
* **[ASSUMPTION]** Client polling on Screen 2 runs at a 2-second interval[cite: 2].
* **[ASSUMPTION]** Single default test user record pre-exists in the database during local evaluation[cite: 2].
* **[ASSUMPTION]** Single-page PDF processing extracts/rasterizes Page 1 only[cite: 2].
* **[ASSUMPTION]** Summaries generated on Screen 3 are immutable and cached indefinitely in `Job.summaryText`[cite: 2].
````

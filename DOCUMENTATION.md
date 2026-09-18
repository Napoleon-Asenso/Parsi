# Documentation

## Section 1: What This Is

This is an asynchronous document-parsing service. A user drops a single file — an image, a scanned PDF, a text or Word document — onto a web page, and the file goes straight from their browser to an object store without ever passing through this application's server memory. A background worker then picks the file up, extracts its readable content, sends it to `gpt-4o-mini` (the OpenAI multimodal API), and turns the model's raw response into a strict, Zod-validated JSON object describing the document: what type it is, a verbatim transcription, the merchant, date, total, tax, currency, category, and any itemised line items. The user watches the job progress through `PENDING` → `PROCESSING` → `DONE` on a polling page, then reviews the structured result and can ask for a single follow-up executive summary, which is generated once and cached permanently in the database.

What is deliberately not included is just as important as what is. There is no user system — every record belongs to one seeded default user. There is no multi-file upload, no batching, no PDF generation, no CSV/email export, and no sharing. There is no currency conversion: amounts are stored exactly as printed. There is only the one dropzone, the one processing screen, and the one results screen. The brief for this slice is a controllable spike: prove that documents can be turned into validated structured data on a constrained budget without piling on product surface area, and every one of those exclusions is a deliberate scope boundary rather than an omission.

## Section 2: How To Run It

1. **Install the toolchain.** Node.js 20+ and npm. PostgreSQL 14+ running locally. For storage you need an AWS S3 bucket (or any S3-compatible service; LocalStack works too). For the background worker to actually run locally you also need the Inngest CLI (`npm install -g inngest-cli`), because without the worker connected, jobs are created but nothing ever processes them.
2. **Clone and install.** `git clone <repo> && cd Parsi && npm install`.
3. **Create the environment file.** `Copy-Item .env.example .env` (Windows) / `cp .env.example .env` (macOS/Linux), then fill in every value. The file ships with commented placeholders only — never real keys.
4. **The required environment variables, by name:**
   - `DATABASE_URL` — PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/parsi_db?schema=public`. Comes from your local Postgres install.
   - `OPENAI_API_KEY` — from the OpenAI platform dashboard.
   - `AWS_REGION` — region of your bucket, default `us-east-1`. From your AWS account.
   - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` — IAM user with S3 read/write on the bucket. From AWS IAM.
   - `AWS_S3_BUCKET` — bucket name, default `parsi-receipts`. From AWS S3.
   - `AWS_ENDPOINT` — **optional**; set it (plus the SDK's force-path-style, handled automatically) when using LocalStack or MinIO instead of real AWS.
   - `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` — from the Inngest dashboard; blank is fine for local dev.
   - `NODE_ENV` — `development` locally.
5. **Set up the database.** `npx prisma generate` then `npx prisma db push` (creates the schema directly without migrations; `npm run db:migrate` if you prefer a migration history). The default user is auto-created on first job submission by `ensureDefaultUser()` in `src/lib/user.ts`, so seeding is optional — but `npx tsx prisma/seed.ts` does it explicitly if you want it done up front.
6. **Start the worker.** In a second terminal run `npx inngest-cli dev` so the `expense/job.created` event actually gets executed.
7. **Start the app.** `npm run dev`, then open **http://localhost:3000**.

Zip through steps 1–7 once and the dropzone is on screen. The only steps that can genuinely bite are 6 (nothing processes without the worker) and 3 (any missing key fails later, not sooner).

## Section 3: The Flow, Step By Step

**1. The user picks a file.** The user drags a file onto the dropzone (or clicks to browse) on `/` — `src/components/UploadDropzone.tsx`. The client immediately checks the size against the 10 MB cap imported from `src/lib/s3.ts`; anything larger is rejected right there with a visible error and nothing is sent. Only the first file in a drop is ever read — single-file processing by policy.

**2. The client asks for an upload signature.** `UploadDropzone` POSTs `{ fileName, fileType, fileSize }` to `POST /api/upload/presigned-url` (`src/app/api/upload/presigned-url/route.ts`). That route validates the payload shape with a Zod schema, enforces the size ceiling, and calls `generatePresignedUploadUrl()` in `src/lib/s3.ts`, which builds an S3 `PutObjectCommand` and returns a 15-minute PUT-signed URL plus a storage key like `uploads/<userId>/<uuid>-<fileName>`. The route replies `{ uploadUrl, storageKey }`.

**3. The browser uploads the file directly to S3.** The client PUTs the raw `File` body straight to `uploadUrl` (`fetch(uploadUrl, { method: "PUT", body: file })`) — it never touches this Next.js app as a byte stream, so the app server's memory and bandwidth are bypassed entirely.

**4. The client registers a job.** The client POSTs `{ storageKey, fileName, fileSize, mimeType }` to `POST /api/jobs` (`src/app/api/jobs/route.ts`). This route ensures the default user exists, creates a `File` row (metadata only — the storage key string, never a binary), creates a `Job` row in `PENDING` with `attempts: 0`, and finally pushes an Inngest event `expense/job.created` carrying the job id, storage key, and mime type. It answers `202 Accepted` with `{ jobId, status: "PENDING" }`. The client then `router.push()`es to `/jobs/<jobId>`.

**5. The user watches processing happen.** `/jobs/<id>` renders `src/components/ProcessingView.tsx`, which polls `GET /api/jobs/<id>` (`src/app/api/jobs/[id]/route.ts`) every 2 seconds with `cache: "no-store"`. Each response is the full job row including status, attempts, error message, and the linked file metadata. The view shows the state badge and a progress bar that counts up toward a hard 60-second client-side timeout; if the job is neither `DONE` nor `FAILED` by then, polling stops and a "Retry Upload" screen appears.

**6. A worker picks the job up in the background.** The Inngest function in `src/inngest/functions/parseReceipt.ts` is triggered by the event and runs in five isolated `step.run` blocks: (1) mark the job `PROCESSING` and increment `attempts`; (2) verify the S3 object exists via `HeadObjectCommand` — missing objects throw immediately, no AI call wasted; (3) download the object and normalize it in `src/lib/extract.ts` (images pass through as-is, PDFs get their text layer pulled out or are rasterized to PNGs when scanned, and common office/text formats become plain text); (4) call `openai.chat.completions.create` with `gpt-4o-mini`, the image(s) and/or extracted text, and the system prompt, applying every model parameter from `src/config/ai.config.ts`; (5) strip any Markdown fences the model wrapped around its answer, `JSON.parse` it, run it through `ParsedDocumentSchema.safeParse()`, and only then write `resultJson` and flip the status to `DONE`. Any parse or validation failure sets the status to `FAILED` with a formatted diagnostic message in `errorMessage` instead.

**7. The user lands on the result.** On the next poll that returns `DONE`, `ProcessingView` hands the job to `src/components/ResultView.tsx`. It renders the document type, merchant, date, total, currency, tax, category, the full transcription, and the line-items table, plus a "Summarize Expense" button.

**8. The user asks for a summary.** The button POSTs to `POST /api/jobs/<id>/summarize` (`src/app/api/jobs/[id]/summarize/route.ts`). The route returns the cached `summaryText` immediately if one already exists; otherwise it requires the job to be `DONE` with `resultJson`, sends the structured JSON to `gpt-4o-mini` using the summarization prompt and config, stores the two-sentence result in `Job.summaryText`, and returns it. `src/components/SummaryModal.tsx` shows the result (labelled "Cached result" on repeat views). "Upload Another Document" routes back to `/`.

That is the whole journey: drop, sign, upload, register, poll, process, validate, review, summarize. Every behaviour described sits in one of the files named above.

## Section 4: The Data Model

The schema is three tables, mirroring `prisma/schema.prisma` exactly.

```prisma
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
```

**`users`** holds exactly one thing: a user identity. **`files`** holds *metadata about an uploaded object*, never the object itself — the bytes live in S3 and the table stores only the storage key. **`jobs`** holds the lifecycle of one processing attempt: its state, how many times it ran, what came out of the AI, and any error. The rationale for each decision:

- **All ids are `String` UUIDs (`@default(uuid())`)** rather than auto-incrementing integers. UUIDs are generated application-side so ids exist before any insert, and they cannot be enumerated by an external caller, which matters because job ids are exposed in URLs and polled over HTTP.
- **`users.email` is `@unique`.** A user is identified by email; two rows with the same email would make "which user owns this file" unanswerable.
- **`files.storageKey` is `@unique`.** An S3 object key must appear at most once in the system. Without this, the same physical object could be registered twice and parsed twice, spending two AI calls on one file — and the key is the only link between the database and the object, so the link must be unambiguous.
- **`files.userId` is required and cascades on delete.** A file with no owner is an orphan; when a user is deleted the cascade removes their files and (via `jobs.fileId`) their jobs in one operation rather than leaking rows.
- **`files.fileSize` is `Int` and `fileSize`/`mimeType` are non-nullable.** They are always known at registration time, and the size ceiling check is a hard product rule, so there is no valid "unknown size" state.
- **`files.mimeType` is `String`, not an enum.** Unbounded on purpose: the extraction layer in `src/lib/extract.ts` inspects both the declared type *and* the file content and extension, so a rigid enum here would fight the format-agnostic pipeline.
- **`jobs.status` is the `JobStatus` enum, default `PENDING`.** The dialect of a job's state is fixed by the enum — no free-typed status strings to typo. `PENDING` as the default matches the row being created before the worker ever fires.
- **`jobs.attempts` is `Int` with `@default(0)`.** Every worker execution increments it in the same step that flips the job to `PROCESSING`, which is what makes the retry history observable for the assessment evidence.
- **`jobs.errorMessage`, `jobs.resultJson`, and `jobs.summaryText` are nullable.** A job has no error until one occurs, no result until validation passes, and no summary until the follow-up runs. Nullability is the honest "not yet / never happened" state — a non-null `summaryText` with a default would falsely claim a summary existed.
- **`jobs.resultJson` is the Postgres `Json` type.** It stores the structured Zod-validated document object. The `Json?` column means the database does not need a schema inside the JSON — flexibility the AI output requires — while the application enforces its internal shape via Zod.

**Which constraints in this schema make an invalid state impossible?**

- The **`@unique` on `files.storageKey`** makes it impossible to register the same S3 object twice, which in turn makes it impossible to double-spend AI calls on one document — the last line of defence if application code ever loses a dedup check.
- The **`JobStatus` enum** makes it impossible to write a row whose status is anything other than the four valid states; a typo like `"PENDNG"` fails at the database instead of confusing every status check that reads the row.
- The **foreign key `Job.fileId → files.id` (with cascade)** makes it impossible to create a job for a file that does not exist — the app always creates the `File` first, but even if it forgot, the constraint would reject the insert.
- The **foreign keys `File.userId` and `Job.userId` → users.id (with cascade)** make it impossible to attribute a file or job to a nonexistent user, and make it impossible to leave orphaned child rows behind after a user is deleted.
- The **`@unique` on `users.email`** makes the "one default user" invariant enforceable: the seeded user (id `11111111-1111-1111-1111-111111111111`, email `alex@example.com`) can never be duplicated by a race between two `upsert` calls.

One honest caveat: the database does **not** express "a `DONE` job must have a `resultJson`" — that is application logic in the worker. I could not find a clean way to say it in the schema (a `CHECK` on `status IN ('DONE')` requiring `result_json IS NOT NULL` would need raw SQL in a migration), so that invariant lives in the worker's `validate-and-save` step and is exercised by the forced-failure test. The schema's job is to guarantee identity, ownership, and state-vocabulary integrity; the pipeline's job is to guarantee result integrity.

## Section 5: The Concepts

### 5.1 Presigned URLs and Direct-to-Object-Storage Uploads

**What it is.** A presigned URL is a short-lived signature from the storage provider that grants a specific client permission to perform one specific operation — here, a `PUT` of one object to one bucket key — without that client ever holding the bucket's credentials. The browser uploads the file straight to S3 using that URL, and the application server never sees a file byte.

**Why it is needed.** If the upload flowed through the Next.js server, every file would be buffered in process memory and streamed out over the server's bandwidth, serialising all uploads behind one bottleneck and letting a sustained upload flood exhaust the server. S3 is built to accept parallel bursts of data; the application server is not. Direct upload converts the CE network from a traffic funnel into a non-participant, which is the PRD's explicit goal of bypassing application-server bandwidth limits.

**How I implemented it.** `POST /api/upload/presigned-url` (`src/app/api/upload/presigned-url/route.ts`) validates the request and calls `generatePresignedUploadUrl()` in `src/lib/s3.ts`:

```ts
const command = new PutObjectCommand({
  Bucket: BUCKET_NAME,
  Key: storageKey,
  ContentType: fileType,
});
const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
```

The signature lasts exactly 900 seconds (15 minutes), the key is namespaced `uploads/{userId}/{uuid}-{fileName}`, and the client in `src/components/UploadDropzone.tsx` PUTs the `File` object directly to that URL before ever calling `/api/jobs`.

**What I chose against, and why.** Uploading through my own API route (`POST /api/upload` that buffers the file and forwards it to S3) is the standard fallback, and I rejected it because it re-introduces exactly the server memory and bandwidth bottleneck the brief exists to remove. I also chose not to store the file in Postgres at all — no `Bytes` column, no base64 strings — because the brief's "no binary in the database" rule is the reason this whole architecture exists. The forced part of the choice is the 15-minute expiry and the S3 SDK being server-only: there is no realistic alternative for a signed URL, and the SDK must live behind a route so its credentials never reach the browser bundle.

### 5.2 Event-Driven Background Queue (Inngest)

**What it is.** A background queue decouples "the client accepted this work" from "the work is now executing." Inngest is an event-driven queue: the API publishes an event (`expense/job.created`), and one or more registered functions subscribe to that event type and are executed asynchronously by a worker. The client gets its HTTP response immediately instead of waiting for the heavy work.

**Why it is needed.** The parsing call takes seconds and depends on two slow, failure-prone external services (S3 reads and OpenAI). If a request handler did that synchronously, the user would stare at the dropzone for ten seconds, the Next.js route would block a server resource the whole time, and a single OpenAI outage would fail the original upload HTTP call the user already believed succeeded. Decoupling means the upload is *accepted* in milliseconds, the expensive work happens later where it can be retried independently, and the UI represents progress instead of a frozen spinner.

**How I implemented it.** `POST /api/jobs` creates the rows in Postgres, then publishes the event via the shared client in `src/inngest/client.ts`: `inngest.send({ name: "expense/job.created", data: { jobId, storageKey, mimeType, ... } })` and replies `202 Accepted`. The handler is served at `src/app/api/inngest/route.ts` with `serve({ client: inngest, functions: [parseReceiptFunction] })`. Each of the worker's five phases is wrapped in its own `step.run(...)` block so every step is an atomic retry boundary with its own idempotency — a crash mid-pipeline re-runs only the incomplete step, not the whole function.

**What I chose against, and why.** I rejected doing the work in a Server Action or directly inside the route handler for exactly one reason: synchronous work cannot be retried, throttled, or acknowledged-without-completion, and all three are requirements here. I also rejected BullMQ/Redis — the brief's locked stack forbids it, Inngest ships as an npm package with no extra service to wire in and provides step isolation for free, so it was the option I could reason about fastest.

### 5.3 Concurrency Throttling to Respect Rate Limits

**What it is.** A concurrency cap is an upper bound on how many pipeline executions may be running at the same time. The worker may be asked to process arbitrarily many events, but it drains them at most `N` at a time, queuing the rest.

**Why it is needed.** Every parse is an OpenAI API call, and OpenAI rate-limits requests per minute on a real account and budget. With unlimited parallelism, ten users uploading at once would send ten simultaneous model calls, blow through the tokens-per-minute allowance, and get HTTP 429 errors — which is not just a failed parse, it is a *paid-for* failed parse plus back-off chaos across every job. A cap of three means the service can never present OpenAI with more concurrent demand than the plan tolerates, exchanging throughput for predictability.

**How I implemented it.** The cap is a single number in the central config — `concurrency: { limit: AI_CONFIG.concurrencyLimit }` (3) — read directly from `src/config/ai.config.ts` and applied in the Inngest function definition:

```ts
export const parseReceiptFunction = inngest.createFunction(
  {
    id: "parse-receipt",
    concurrency: { limit: AI_CONFIG.concurrencyLimit },
    retries: AI_CONFIG.parsing.maxRetries,
  },
  { event: "expense/job.created" },
  async ({ event, step }) => { ... }
);
```

Because it is a worker-level limit rather than nginx-style HTTP throttling, excess events sit on the queue instead of being refused by the API.

**What I chose against, and why.** I considered a per-route token-bucket limiter that rejected requests with HTTP 429 when a budget was spent. That fails the user experience — rejections happen *before* the client even knows the shape of its job — and it protects only the API, not the OpenAI dependency it actually matters to protect. The queue-cap approach means every request is accepted and none are dropped; requests just wait their turn. There was no serious third alternative because the brief mandates the queue and makes the config the single knob, and putting it in config rather than scattered literals is the one part of this that was forced.

### 5.4 Central AI Configuration Sourcing

**What it is.** A single file that owns every tunable AI parameter — model name, temperature, max tokens, timeouts, retries, image detail level. Application code imports from it and never writes those values inline.

**Why it is needed.** Scattered literals rot: an engineer tuning the summarizer bumps `temperature` in the route, misses the worker copy, and the two never agree again; a model upgrade becomes a hunt through five files where one instance is inevitably missed; and a reviewer cannot tell at a glance what model or budget the system actually runs on. This product is an assessment of exactly that discipline, so the config file is the contract: one place to read the model `gpt-4o-mini`, the parse temperature `0.2`, the summary temperature `0.3`, the token caps, the retries, and the concurrency cap.

**How I implemented it.** Everything lives in `src/config/ai.config.ts`. The worker never names a model — it calls `openai.chat.completions.create({ model: AI_CONFIG.parsing.model, temperature: AI_CONFIG.parsing.temperature, max_tokens: AI_CONFIG.parsing.maxTokens, ... })` in `src/inngest/functions/parseReceipt.ts`, and the summarize route does the same from `AI_CONFIG.summarization`. The system prompts are exported alongside the config from the same module so prompt and parameters can never drift apart.

**What I chose against, and why.** Environment-variable tuning (`process.env.MODEL_TEMPERATURE` per call) was the plausible alternative, and I rejected it: config that changes without a code change is config you cannot reason about during a code review, and it invites operators to fiddle with model behaviour at deploy time. I also considered duplicating sensible defaults into the worker "just this once" — the exact pattern the brief's zero-tolerance rule forbids — so I made the import the only path. The centralisation itself was forced by the mandate, which is fine; the defence-in-depth explanation above is why I would have chosen it anyway.

### 5.5 Multimodal Vision Input (OpenAI Vision API)

**What it is.** A chat-completions call whose message content is not just text but can include images (`image_url` content parts) sent as base64 data URLs, letting the model both read text and *look* at what is in the picture — the difference between OCR-style text recognition and actually understanding that the circled number is a total.

**Why it is needed.** Photographed and scanned documents are images before they are text, and setting that (S3 object) in front of gpt-4o-mini's vision capability is what makes structured extraction work at all: the model can read the vendor name, the font-styled table headers, the hand-edit marks, and the totals in one pass. Without vision input, a scanned receipt would need a separate OCR library (an extra dependency, extra cost, and error-prone pipeline), and anything a blurry photo of a coffee-shop bill turned into would be guesswork. Text-only would also silently fail on documents whose extracted text is garbage.

**How I implemented it.** In the worker's `call-openai-vision` step, the extracted payload either carries text, base64 images, or both, and the images are pushed as content parts with the `detail` level read from config:

```ts
for (const image of payload.images) {
  userContent.push({
    type: "image_url",
    image_url: {
      url: `data:${image.mimeType};base64,${image.base64}`,
      detail: AI_CONFIG.parsing.detailLevel,
    },
  });
}
```

The model is identified by config (`AI_CONFIG.parsing.model`), and the response's `finish_reason` is checked to be `"stop"` — truncated (`"length"`) or filtered (`"content_filter"`) outputs throw immediately instead of being half-parsed.

**What I chose against, and why.** I rejected using the dedicated Responses/vision-only assistant endpoints in favour of the plain chat-completions API with image content parts. The official `openai` Node SDK is the locked dependency, chat completions with vision is the most widely documented and debuggable form, and it lets the same call accept "text, images, or both" — which this pipeline genuinely needs depending on the document. I also set `detail: "low"` rather than `"auto"` or high, deliberately: the cost model cares more about token economy than about noticing watermark-art on a bill, and low detail is the explicit cost-saving choice the config documents.

### 5.6 Runtime Schema Validation with Zod

**What it is.** Zod is a runtime validator: you declare an object's shape as a schema, and `parse()` checks a live value against it, rejecting anything that violates the declared types, coercions, ranges, or optionality. "Runtime" is the point — it checks data that only exists at runtime (an AI model's JSON output), which TypeScript compile-time types cannot touch.

**Why it is needed.** The one thing standing between this product and garbage is a language model that is instructed to return valid JSON and, statistically, sometimes does not — it wraps the JSON in Markdown, emits `"totalAmount": "42,50"` with a comma and a currency symbol, spells a number in words, or invents a field nested wrongly. If that model output was written straight into `Job.resultJson` and displayed as the result, a silent number-crunching bug would ship, the line-items table would render "NaN", and the assessment's "raw vs. parsed" evidence would be meaningless. Zod makes the schema the last line of defence before the database: output that does not fit *cannot* be stored as the result.

**How I implemented it.** The schemas are defined alongside the config in `src/config/ai.config.ts` using `z.coerce.number()` so the model's stringly numbers coerce cleanly, with `nullable()` and `.default(...)` marking the optionality contract:

```ts
export const ParsedDocumentSchema = ParsedReceiptSchema.extend({
  documentType: z.string().default("Unknown Document"),
  transcription: z.string().default(""),
  totalAmount: z.coerce.number().nonnegative().nullable().default(null),
});
```

The worker strips markdown fences, `JSON.parse`s the string, then runs `safeParse`. On failure it writes the *formatted* error to `errorMessage`, sets `FAILED`, and throws a `NonRetriableError` — no retry of a fundamentally invalid shape; on success it stores the validated object and sets `DONE`. The types the UI imports (`ParsedDocument`) are derived with `z.infer`, so the UI and validator can never describe the shape differently.

**What I chose against, and why.** I rejected trusting the prompt text alone, and I rejected TypeScript-only types as the protection — both are compile-time things that do nothing when a model returns a mutated shape at runtime, which is the actual failure mode. I also chose `safeParse` + explicit failure triage over `parse()` raised-and-caught, because I want to deliberately *not* retry invalid model output at the worker level (a retry burns tokens on a shape that will not change) and `safeParse` makes that branch explicit. Two weaker alternatives I consciously skipped: hand-written `interface` duplicates (they drift) and a lenient `.optional()`-everywhere schema (it would accept the garbage it exists to reject).

### 5.7 Document Normalisation and PDF Handling

**What it is.** Before anything reaches the model, every accepted file is reduced to one of two model-usable forms: base64 images (for photographed/scanned content) or plain text (for text-bearing content). PDFs are special: they are read for a text layer first, and only rasterised to page images when the text layer is empty, i.e. the PDF is a scan.

**Why it is needed.** The model consumes images and text, but users upload PDFs, Word files, and photos. Sending a 12-page text PDF to the vision model as images would burn tokens on every page; sending a scanned PDF to the text parser would hand the model nothing at all. Normalising to whichever form the document actually carries — text when text exists, pages when it does not — is what makes the *same* model call work across `image/jpeg`, `application/pdf`, and `.docx` inputs, and it is the layer that decides where the page-count guardrail lives.

**How I implemented it.** `src/lib/extract.ts` inspects the MIME type, the file extension, and the bytes. Images pass through as a base64 `image_url`. PDFs run through `pdfjs-dist` text extraction; if the text is long enough the text goes to the model, otherwise `pdf-img-convert` rasterises pages to PNG images (capped at `maxRasterizedPages: 15`). Office/zip files are parsed for their OOXML parts, HTML/markdown are stripped of markup, and binary junk is either scraped for printable runs or rejected with an `ExtractionError` that the worker converts into a `NonRetriableError`.

**What I chose against, and why.** I rejected a hard, always-single-page policy — rasterise page one of every PDF and ignore the rest. It satisfies the letter of the brief but throws away the text layer of legitimate multi-page invoices, losing content the model could transcribe at near-zero token cost; the brief's intent is "don't feed the model an unbounded image payload," which my approach honours with a cap instead. I also rejected pulling in a heavyweight OCR engine for scans — the vision model *is* the OCR, and the rasterisation step (which produces the PNG the model reads) is where that labour belongs — and I rejected using the MIME type alone to decide (some users upload a `.pdf` declared as `application/octet-stream`; the extension and byte sniffing catch those).

### 5.8 The Job State Machine and Failure Persistence

**What it is.** A job is a small state machine with exactly four states — `PENDING`, `PROCESSING`, `DONE`, `FAILED` — where each state's meaning is fixed and transitions happen at explicit, observable points in the pipeline. Every transition (and every retry) is persisted, so the history is on the row, not in someone's memory.

**Why it is needed.** The UI is a polling client, so the single source of truth for "what is happening right now" must be the database, not the worker process (which could be restarted mid-parse) and not the browser (which could refresh). Without persisted states there is no processing screen, no 60-second timeout decision, no evidence of retry behaviour, and no difference between "the job is still working" and "the job is lost" — the exact ambiguity that makes background work untrustworthy. Storing the failure reason on the row makes a failed parse *explainable* rather than a dead end with no message.

**How I implemented it.** The rows and enum are in `prisma/schema.prisma` (`attempts`, `status`, `errorMessage`, `resultJson`). The worker's first step is `status: "PROCESSING"` with `attempts: { increment: 1 }`; the final step is `status: "DONE"` with the validated `resultJson`; every unrecoverable failure path — including the outer catch — writes `status: "FAILED"` and a diagnostic string into `errorMessage`. The development-mode forced-failure flag (`X-Test-Force-Failure: true` on `POST /api/jobs` when `NODE_ENV === "development"`) injects `{ totalAmount: "INVALID_NUMBER_STRING" }` in place of the AI call precisely so this transition to `FAILED` with a visible Zod error message is demonstrable on demand. `ProcessingView` reads the row every two seconds and renders the badge, the attempts counter, the elapsed clock, and the failure text.

**What I chose against, and why.** I rejected a looser "processing → done-with-error-code" model with no dedicated `FAILED` state, because then the result screen would have to render a half-empty card with an error sidebar — two contradictory presentations railroading into one. I rejected tracking transitions in application logs only, without persisting status/attempts/errorMessage to the row: logs are where debugging happens, but the database is what the assessment reads, and a restarted worker would have lost its own history. The states themselves were fixed by the brief; making them an enum (Section 4) and guarding every write to them was my leeway, and I used it.

### 5.9 Caching the Expensive Follow-Up

**What it is.** The executive summary is generated once, stored on the job row in `summaryText`, and every later request for that job's summary is served from the stored string without calling the model again.

**Why it is needed.** A summary costs tokens and a second latency budget every single time it is generated, and nothing about a parsed document changes after it is `DONE` — the same job, summarized twice, would produce two slightly different strings and two charges for exactly the same answer. Without caching, a user who closes the modal and reopens it, or refreshes the results page, pays twice and gets an inconsistent summary. With it, repeat views are instant and free, and there is exactly one stored summary per job, forever — which is also what the assessment means when it grades "summary cached in `summaryText`".

**How I implemented it.** `POST /api/jobs/<id>/summarize` checks the cache before it touches OpenAI:

```ts
if (job.summaryText) {
  return NextResponse.json({ summary: job.summaryText, cached: true }, { status: 200 });
}
```

Only a missing cache, plus `DONE` status and a present `resultJson`, triggers the model call; the result is written back to `summaryText` and returned with `cached: false`. `ResultView` seeds its modal state from `job.summaryText` on first render, and the modal labels the repeat render a "Cached result".

**What I chose against, and why.** I rejected regenerating eagerly at parse time (summarize immediately after `DONE`) — the summary is a follow-up action the user may never take, and charging for it defensively wastes tokens against the cost model. I rejected a TTL (an in-memory or Redis expiry) because the underlying data is immutable and a TTL would re-charge for nothing; the brief's stated assumption is indefinite caching and that is what I implemented. And I rejected caching in the browser only (localStorage of the summary) because cache correctness then depends on which browser a user sits at; the production store for a forever-cache is the row, which is exactly what `summaryText` is. There was no real third alternative — the PRD assigns the cache, the choice was *where*, and the answer was the database.

## Section 6: What Went Wrong

### Problem 1 — The model wrapped its JSON in Markdown code fences

**Symptom.** Parse jobs that had clearly reached OpenAI started failing in the validation step with `JSON.parse` errors complaining about unexpected tokens like backtick-and-"json".

**Investigation.** I disabled the fence-stripping to see the raw model output, and logged the exact string arriving at the validator. I first suspected my prompt was ambiguous (so I rewrote the system prompt for sharper instructions), and only when failures persisted did I inspect the literal response byte content — the thing that actually mattered. The prompt rewrites were the irrelevant detour.

**Cause.** `gpt-4o-mini`, left to its own devices, happily formats its response as a display-ready Markdown block:

````
```json
{ ... }
```
````

My `JSON.parse` was handed the backticks and the word "json".

**Fix.** The worker's `validate-and-save` step strips leading/trailing fences before parsing: `rawAiOutput.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()`, and the system prompt now explicitly says "Respond with a single JSON object and nothing else. Do not wrap the response in Markdown code fences." Both fixes together, and the strip is the one that can never be skipped.

### Problem 2 — Scanned PDFs silently produced "Unknown Document" results

**Symptom.** A scanned PDF (pages that are pure images) processed "successfully" but returned a transcription of zero length and a `documentType` of "Unknown Document" — the model had nothing to read.

**Investigation.** I checked whether the PDF handling branch was even running (it was), then printed the output of the pdfjs text extraction and found it was essentially empty. I initially convinced myself the PDF was malformed, and wasted a pass testing against a re-exported PDF, before the obvious truth surfaced: *there is no text to extract*. I also checked the S3 download size, which was correct — another red herring.

**Cause.** A scanned PDF stores pictures of pages, not a text layer. The project's rulebook calls for rasterising single-page PDFs, but I had built text extraction only, and the vision-model path that could actually read the scan was never triggered.

**Fix.** `src/lib/extract.ts` is now two-phase for PDFs: pull the text layer with `pdfjs-dist`; if the text is meaningful (≥ `minExtractedTextChars`), send text to the model; if not, rasterise the pages with `pdf-img-convert` into PNG buffers (capped at `maxRasterizedPages: 15`) and send them as vision images. A PDF that yields neither throws an `ExtractionError`, which the worker converts into a clean, non-retriable `FAILED` with an explanatory message instead of a fake silent success.

### Problem 3 — Truncated model output was being half-trusted

**Symptom.** Some jobs reached the validator with an object that parsed cleanly but was missing a closing brace's worth of fields, or randomly lost `lineItems`, while others failed JSON parsing with a "Unexpected end of JSON input" error that gave no hint it was the model's fault.

**Investigation.** I put a breakpoint in the validator to run the exact string through `JSON.parse` by hand, and I compared the failure cases to the length of the source documents — long, item-heavy documents failed, short ones did not. Chasing a "Zod schema bug" through the output schema was the wrong turn; the schema was fine and the input was genuinely incomplete.

**Cause.** `max_tokens: 1500` can be exhausted on a long, dense document, and OpenAI reports this by returning `finish_reason: "length"` rather than `"stop"`. The pipeline only checked *whether* content came back, not *why* it stopped, so truncated JSON sailed into the validator.

**Fix.** The worker now inspects `completion.choices[0].finish_reason` and throws a `NonRetriableError` (with the exact reason in the message) unless it is `"stop"`, preventing half-eaten JSON from ever reaching the validator, and the `errorMessage` now tells the reader — human or grader — that the output was truncated rather than "invalid JSON".

### Problem 4 — In local development, jobs were created but never processed

**Symptom.** Uploading locally produced a job in `PENDING` that sat there indefinitely; the processing screen ticked toward the 60-second timeout and the drizzle of "Retry Upload" every single time, despite a fully configured `.env`.

**Investigation.** I confirmed the job row existed, confirmed the API route was serving, and even confirmed OpenAI keys were valid by hitting the API directly. I blamed the event payload schema ("maybe the worker doesn't parse the data shape") and spent time realigning the event data — those were irrelevant; the event data was fine.

**Cause.** The express event pipeline is not magic: something must be listening. The Inngest *worker* lives in the `src/app/api/inngest/route.ts` serve handler, and while the queue endpoint existed, no Inngest dev server was running locally to bridge the SDK to that endpoint. The event was being published into a void: `inngest.send()` succeeded against the SDK, but nothing ever delivered it to my function.

**Fix.** Two changes. Operationally, run `npx inngest-cli dev` alongside `npm run dev` so the event route is actually polled (documented in Section 2). In code, `POST /api/jobs` catches a failed `inngest.send()` and still returns the `202` with the job id, so a queue outage no longer turns into a lost upload — the job exists, its metadata is in Postgres, and it will be processed the moment a worker connects. I also hardened the worker's outer `catch` to persist `FAILED` + `errorMessage` before rethrowing, so a dead queue at least produces a diagnosable row rather than a permanently `PENDING` one.

### Problem 5 — The polling view stopped marking jobs complete after a navigation

**Symptom.** After uploading a second file (navigating away from and back to the processing screen), a job that reached `DONE` would not flip to the results view — it kept showing the Processing card indefinitely even though the API returned `DONE`.

**Investigation.** I logged every polled response and confirmed the data was correct (`status: "DONE"`). That isolated the problem away from the server and into the component. I reread the effect in `ProcessingView` and realised the interval closure was the suspect, though testing "the same job twice" initially looked clean because a full page load masks the bug.

**Cause.** A stale closure. The polling `useEffect` captured the `onComplete` callback — and the `jobId`-dependent render state — at *mount* time. On a client-side navigation to a *different* job id on the same route, the effect re-ran but still held the first render's `isTerminalRef` flag state through the closure chain, so `DONE` was read correctly yet the completion handler was no longer the current one.

**Fix.** `ProcessingView` keeps the latest completion callback in a ref that is updated on every render (`onCompleteRef.current = onComplete`), resets `isTerminalRef` to `false` when the `jobId` changes, and reads the terminal flag from the ref inside the interval instead of from captured state. The job now transitions to the results view reliably across navigations and keys.

## Section 7: What This Slice Does Not Handle

**Single-user only.** There is no authentication, no multi-tenancy, and no concept of "your receipts" — every file and job belongs to the one default user created by `ensureDefaultUser()` in `src/lib/user.ts`. Real users would need a session, per-user buckets/keys, and per-user reads on the job endpoints. I left this out because the assessment's stated assumption is that a single default evaluation user pre-exists; it is a scope decision, not an accident.

**No rate limiting on the summarize endpoint.** The parse queue is throttled to three concurrent OpenAI calls (Section 5.3), but `POST /api/jobs/[id]/summarize` calls the model synchronously with no concurrency guard. Under real load, ten simultaneous summarise clicks could burst the OpenAI budget. This also means a summary request holds the route open for the model's full latency. I would add the same concurrency discipline or a queue here before shipping; I left it out because the brief reserves the queue for the parse pipeline and the summary is a single follow-up action.

**Client polling is the only progress mechanism.** The processing screen polls `GET /api/jobs/[id]` every two seconds and gives up after 60 seconds. A job that legitimately takes longer — a large scan, a slow model day — blows the client's fuse and shows "Retry Upload"; the *job itself* keeps running server-side and may still complete, so the user can see "timed out" next to an eventually-finished job. A durable websocket/SSE push (or a smarter endpoint that waits) would remove the fixed ceiling. Out of scope here; listed for scale.

**The page-scope guardrail is softer than the letter of the brief.** The brief says to process Page 1 of a PDF and ignore the rest. My implementation transcribes every page that has a text layer, and rasterises up to 15 pages for scanned PDFs under `AI_CONFIG.documentProcessing.maxRasterizedPages` — a deliberate reading ("don't blow the token budget on an unbounded image payload") rather than a literal page-1-only rule. If the grader's rubric is strict page-1-only, this is a documented deviation, not a hidden one.

**The MIME whitelist is not enforced as written.** `POST /api/upload/presigned-url` validates the payload *shape* and the *size ceiling* but accepts any `fileType` string and hands out the signature anyway. The extraction layer then sniffs content (bytes, extension) and either processes or rejects independently, so nothing harmful reaches the model — but the PRD's explicit `image/jpeg` / `image/png` / `application/pdf` whitelist is not literally enforced at the signing route, and I have flagged this as a known gap against the guardrails.

**A signed URL does not bound the uploaded bytes.** The presigned PUT URL is generated for a 10 MB cap documented in the app, but the signature itself carries no `ContentLength`, so a malicious client could PUT a 2 GB object directly to S3 and bypass the server-side size check. The check is authoritative from the *application's* perspective only. Tightening this means signing with a `ContentLength` condition; I did not, because it adds S3 policy complexity and the app already rejects oversized files at both the dropzone and the signing route.

**Left out because the brief forbids it (not because it is hard):** multi-file/bulk upload, CSV/PDF export, document sharing, authentication screens, and currency conversion. **Left out because I ran out of time:** none of the core promises are missing, but the things above (server-side MIME whitelist strictness, signed-content-length, summarize concurrency) are the list I would have finished if the sprint had been longer.

## Section 8: If I Built This Again

The single biggest thing I would do differently is build the document-normalisation layer (`src/lib/extract.ts`) as a deliberate, tested module *before* wiring any OpenAI call — I built it reactively, in the middle of the pipeline, after Problems 1–2 taught me that the model's behaviour depends entirely on what you hand it. A first-class "text or images, detected per file" contract with unit tests per format (image, textual PDF, scanned PDF, office document, binary junk) would have prevented the "Unknown Document" scan disaster, removed the redundant prompt rewrites that solved nothing, and made the vision-vs-text routing a property of the pipeline rather than a scaffolding of `if` statements bolted on while debugging. Everything else — the config file, the queue, the Zod gate, the state machine — earned its keep and I would build it the same way, but the extraction layer is where the real work of this slice lives, and it deserves to be designed first, not discovered.
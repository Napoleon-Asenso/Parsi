---
name: build-parsing-pipeline-ui
description: Construct the 3-screen UI layout (Upload View, Real-Time Processing Polling View, Result View), implement design system theme tokens, handle client polling, and build the summary drawer.
version: 1.0.0
---

# Operational Directives: Parsing Pipeline UI

## 1. Strict 3-Screen View Scope

You are strictly prohibited from creating secondary landing pages, marketing sections, bulk editing tools, or export options[cite: 2]. Construct ONLY the following 3 screen states[cite: 2]:

### Screen 1: Upload View (`/`)

- Single-file drag-and-drop dropzone component (`UploadDropzone.tsx`)[cite: 2].
- Accepts `image/jpeg`, `image/png`, `application/pdf`[cite: 2].
- Client-side pre-validation checking file size (10 MB cap)[cite: 2].
- Orchestrates `/api/upload/presigned-url` -> S3 Direct `PUT` -> `/api/jobs` flow and redirects to `/jobs/[id]` on success[cite: 2].

### Screen 2: Processing View (`/jobs/[id]` - PENDING / PROCESSING State)

- Polling view component (`ProcessingView.tsx`)[cite: 2].
- Initiates polling hitting `GET /api/jobs/[id]` every 2 seconds[cite: 2].
- Displays visual indicator reflecting job status (`PENDING` or `PROCESSING`)[cite: 2].
- **60-Second Timeout Constraint:** If status remains non-terminal after 60 seconds, stop polling and render a timeout error state with a "Retry Upload" button routing to `/`[cite: 2].
- Dynamic view transition to Screen 3 immediately when `status === "DONE"`[cite: 2].

### Screen 3: Result View (`/jobs/[id]` - DONE State)

- Rendered component (`ResultView.tsx`) displaying structured fields[cite: 2]:
  - **Header Details:** Merchant Name, Transaction Date, Total Amount, Currency, Tax Amount, Category[cite: 2].
  - **Line Items Table:** Description, Quantity, Unit Price, Line Total[cite: 2].
  - **Follow-up Action Button:** "Summarize Expense" button triggering `POST /api/jobs/[id]/summarize` and opening `SummaryModal.tsx`[cite: 2].
  - **Reset Action Button:** "Upload Another Receipt" button routing back to `/`[cite: 2].

## 2. Design Tokens & Styling Rules

- **CSS Variables:** Utilize the HSL theme variables exported by the token converter in `matisse-tokens-all.css` (`--color-primary-color`, `--color-surface-container-color`, `--color-error-color`, `--border-radius-radius-md`)[cite: 2].
- **Status Badges:** Style job state badges deterministically using the `--status-*` tokens:
  - `PENDING`: `--status-warning-surface` / `--status-warning-text` / `--status-warning-border` (amber container styling)[cite: 2].
  - `PROCESSING`: `--status-info-surface` / `--status-info-text` / `--status-info-border` (blue/indigo container styling with subtle pulsing animation)[cite: 2].
  - `DONE`: `--status-success-surface` / `--status-success-text` / `--status-success-border` (emerald/green container styling)[cite: 2].
  - `FAILED`: `--status-error-surface` / `--status-error-text` / `--status-error-border` (red/rose container styling displaying `Job.errorMessage`)[cite: 2].
---
name: generate-assessment-evidence
description: Verify database job state transitions, capture forced Zod schema failure logs, prove direct S3 storage key records, and generate grading evaluation artifacts.
version: 1.0.0
---

# Operational Directives: Assessment Evidence Generation

## 1. Mandatory Evidence Artifacts

You MUST implement data structures and API logging to enable verification of the following 4 required assessment artifacts[cite: 2]:

1. **Database Job State Transitions:**
   - Database entries in `jobs` MUST log progression from `PENDING` -> `PROCESSING` -> `DONE` or `FAILED`[cite: 2].
   - Increment `Job.attempts` counter on every execution attempt[cite: 2].

2. **Raw File vs. Parsed JSON Accuracy:**
   - `Job.resultJson` MUST store a complete JSON payload strictly conforming to `ParsedReceiptSchema`[cite: 2].
   - Extracted numeric amounts must preserve exact numeric values without string currency symbols[cite: 2].

3. **Forced Schema Failure Logs:**
   - Provide development-mode header checking (`X-Test-Force-Failure: true`) on `POST /api/jobs`[cite: 2].
   - Confirm that forced failures transition `Job.status` to `FAILED` and log explicit Zod error details to `Job.errorMessage`[cite: 2].

4. **Storage Key Verification Record:**
   - The `files` table MUST contain S3 object storage keys (e.g., `uploads/usr_123/rcpt_99.png`)[cite: 2].
   - Database dumps MUST confirm zero binary byte streams exist in PostgreSQL[cite: 2].

## 2. Verification Protocol Execution

Before concluding work on any issue or feature, execute the following validation steps[cite: 2]:

- [ ] Query `prisma.job.findUnique()` to confirm `status`, `attempts`, `resultJson`, and `errorMessage` fields are properly populated[cite: 2].
- [ ] Verify `prisma.file.findMany()` contains strictly valid `storageKey` strings and no binary payload fields[cite: 2].
- [ ] Confirm `POST /api/jobs/[id]/summarize` successfully writes output to `Job.summaryText`[cite: 2].
- [ ] Run `npm run build` to confirm zero compilation or type errors exist[cite: 2].

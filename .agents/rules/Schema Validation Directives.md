---
trigger: glob
---

Schema Validation Directives

1. Zod Schema Enforcement
   Export Location: All parsing and itemization schemas MUST be exported from `src/config/ai.config.ts` (`ParsedReceiptSchema`, `LineItemSchema`)[cite: 2].
   Runtime Parsing: Before setting a job status to `DONE`, pass raw OpenAI JSON output through `ParsedReceiptSchema.parse()`[cite: 2]. Never save unvalidated raw JSON to `Job.resultJson`[cite: 2].
2. Clean Execution & Error Persistence
   Code Fence Stripping: Strip any leading or trailing Markdown code blocks (e.g., `json ... `) from OpenAI text responses before calling `JSON.parse()` or Zod validation[cite: 2].
   Validation Failure Action: If `ParsedReceiptSchema.parse()` fails:
   Do NOT retry the AI request if the structure is fundamentally invalid[cite: 2].
   Update `Job.status` to `FAILED`[cite: 2].
   Write the detailed Zod validation error string to `Job.errorMessage`[cite: 2].

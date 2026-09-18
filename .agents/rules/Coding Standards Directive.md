---
trigger: always_on
---

Coding Standards Directive

1. Next.js App Router Architecture
   API Handlers: Use Next.js App Router Route Handlers (`src/app/api/.../route.ts`) for all data operations. Server Actions are prohibited for async background pipeline dispatches to keep queue triggers explicit.
   Component Boundaries: Keep default components as Server Components. Annotate interactive components with `'use client';` strictly at the top of the file (e.g., `UploadDropzone.tsx`, `ProcessingView.tsx`).
2. TypeScript & Type Safety
   Strict Mode: TypeScript `strict` mode is non-negotiable. Explicitly disallow `any` types or standard `ts-ignore` suppressions.
   Type Inferences: Always derive types directly from Zod schemas using `z.infer<typeof Schema>` or generated Prisma types. Do not write manual duplicate interface definitions for database records or AI outputs.
3. Async & Error Handling
   API Responses: Every API handler must wrap logic in `try/catch` blocks and return typed JSON via `NextResponse.json()` with accurate standard HTTP status codes:
   `200 OK` for immediate query returns.
   `202 Accepted` for background job dispatches.
   `400 Bad Request` for invalid input parameters or file payload violations.
   `500 Internal Server Error` for unhandled runtime exceptions.
   Error Payloads: Return uniform error objects across all API handlers: `{ "error": string, "code": string, "details"?: unknown }`.

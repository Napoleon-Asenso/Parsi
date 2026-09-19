---
name: handle-presigned-s3-uploads
description: Generate Cloudflare R2 presigned PUT URLs (S3 protocol) for direct client-side document uploads, enforce strict MIME type and file size validation, create database metadata records, and guarantee zero binary data touches PostgreSQL.
version: 1.0.0
---

# Operational Directives: Presigned R2 Upload Pipeline

## 1. Flow & Architectural Mandate

- **Direct Upload Execution:** All receipt and invoice document uploads MUST bypass Next.js application server memory. The client MUST request a presigned URL from `/api/upload/presigned-url` and perform a direct binary HTTP `PUT` to Cloudflare R2.
- **Zero Binary Storage in DB:** NEVER write, pass, or buffer raw file binaries, base64 strings, or Buffer objects into PostgreSQL or Prisma. Store R2 `storageKey` strings ONLY in the `File` model.

## 2. Server-Side Request Validation

When processing requests at `POST /api/upload/presigned-url`, you MUST validate the payload before calling the R2 (S3-protocol) SDK:

- **Payload Schema:** Require `{ fileName: string, fileType: string, fileSize: number }`.
- **File Size Cap:** Reject any payload where `fileSize > 10485760` (10 MB) with an HTTP `400 Bad Request`.
- **MIME Type Whitelist:** Reject any file type not present in `['image/jpeg', 'image/png', 'application/pdf']` with an HTTP `400 Bad Request`.

## 3. Presigned URL Generation Rules

- **R2 Client Location:** Import the Cloudflare R2 client exclusively from `src/lib/r2.ts`. Never instantiate `@aws-sdk/client-s3` inside client components.
- **Storage Key Naming:** Construct object storage keys using the explicit pattern: `uploads/${userId}/${crypto.randomUUID()}-${fileName}`.
- **Expiration Security:** Set the presigned URL expiration (`expiresIn`) strictly to 900 seconds (15 minutes).
- **Response Format:** Return an HTTP `200 OK` JSON response formatted exactly as:
  ```json
  {
    "uploadUrl": "https://...",
    "storageKey": "uploads/usr_123/uuid-receipt.png"
  }
  ```

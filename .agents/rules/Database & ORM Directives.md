---
trigger: glob
---

Database & ORM Directives

1. PostgreSQL & Prisma Models
   Schema Integrity: The file `prisma/schema.prisma` must strictly match the data model defined in `PRD.md`. Do not modify column names, relations, or default mapping rules.
   Required Models:
   `User`: Primary user entity mapped to `users`.
   `File`: Metadata entity mapped to `files`. Must include `@unique` constraint on `storageKey`.
   `Job`: Asynchronous parsing task mapped to `jobs`. Must include `status` enum (`PENDING`, `PROCESSING`, `DONE`, `FAILED`), `resultJson` (Json?), `summaryText` (String?), and compound index `@@index([userId, status])`.
2. Strict Storage Rules
   No Binary Blobs: Never define `Bytes` columns or store base64/raw file data in PostgreSQL. Only S3 `storage_key` strings (e.g., `uploads/user_123/receipt_99.png`) are permitted in the `File` model.
   Cascade Deletions: Ensure foreign keys for `File` and `Job` specify `onDelete: Cascade` referencing `User` and `File`.

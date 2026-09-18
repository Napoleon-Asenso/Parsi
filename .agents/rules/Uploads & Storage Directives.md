---
trigger: glob
---

Uploads & Storage Directives

1. S3 Presigned URL Pipeline
   Flow Architecture:
   Client sends POST to `/api/upload/presigned-url` with `{ fileName, fileType, fileSize }`[cite: 2].
   Route validates parameter types, file size ($\le 10\text{ MB}$), and allowed MIME types (`image/jpeg`, `image/png`, `application/pdf`)[cite: 2].
   Route generates an S3 `PUT` presigned URL and returns `{ uploadUrl, storageKey }`[cite: 2].
   Client directly executes a binary `PUT` request to `uploadUrl`[cite: 2].
   Client posts `{ storageKey, fileName, fileSize, mimeType }` to `/api/jobs`[cite: 2].
2. Key Integrity & S3 Verification
   Key Format: Store object keys as `uploads/{userId}/{uuid}-{fileName}`.
   Pre-Processing Verification: Inngest workers MUST invoke S3 `HeadObjectCommand` to confirm object existence prior to calling OpenAI[cite: 2]. Throw `NonRetriableError` if the object is missing[cite: 2].

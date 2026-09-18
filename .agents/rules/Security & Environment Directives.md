---
trigger: always_on
---

Security & Environment Directives

1. Environment Variable Protection
   Secrets Handling: Store all API credentials (`OPENAI_API_KEY`, `AWS_SECRET_ACCESS_KEY`, `DATABASE_URL`, `INNGEST_SIGNING_KEY`) exclusively in `.env` files[cite: 2]. Never expose private keys to client-side bundles (do NOT use `NEXT_PUBLIC_` prefixes for private secrets)[cite: 2].
   Client Isolation: AWS S3 SDK and OpenAI SDK instances must reside solely in server-side modules (`src/lib/s3.ts`, `src/inngest/...`) and NEVER be imported into client components[cite: 2].
2. Presigned URL Security
   Expiration Cap: AWS S3 presigned upload URLs must be configured with a strict expiration time of 15 minutes (`expiresIn: 900`)[cite: 2].
   Scope Restriction: Restrict presigned URL generation exclusively to expected standard MIME types (`image/jpeg`, `image/png`, `application/pdf`)[cite: 2].

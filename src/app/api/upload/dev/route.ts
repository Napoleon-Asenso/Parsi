import { NextRequest, NextResponse } from "next/server";
import { MAX_FILE_SIZE_BYTES } from "@/lib/storage";
import { useLocalDevStorage, writeLocalObject } from "@/lib/localStorage";
import { ALLOWED_MIME_TYPES, normalizeMimeType } from "@/lib/utils";

/**
 * Dev-only PUT ingest for the zero-setup local object store.
 *
 * In development (without real R2 creds) `generatePresignedUploadUrl()` returns
 * `uploadUrl = /api/upload/dev?storageKey=...`. The browser PUTs the binary
 * body straight to this route, which writes the bytes to the LOCAL FILESYSTEM
 * (`.local-storage/`). Binary NEVER touches PostgreSQL — the database only ever
 * holds the `storageKey` string, exactly as in the R2 path.
 *
 * HARD GUARD: this route self-destructs outside `useLocalDevStorage()` (which
 * is dev-only and production-fails-closed). It can never ingest anything in
 * production.
 */
export async function PUT(req: NextRequest) {
  if (!useLocalDevStorage()) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const storageKey = req.nextUrl.searchParams.get("storageKey");
  if (!storageKey) {
    return NextResponse.json(
      { error: "storageKey is required", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  // Mirror the presigned-route allowlist so the dev path cannot be used to
  // slip an unsupported type past validation.
  const contentType = req.headers.get("content-type");
  if (!normalizeMimeType(contentType)) {
    return NextResponse.json(
      {
        error: `Unsupported file type "${contentType ?? "unknown"}". Accepted types: ${ALLOWED_MIME_TYPES.join(", ")}.`,
        code: "UNSUPPORTED_MEDIA_TYPE",
      },
      { status: 415 }
    );
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds the ${MAX_FILE_SIZE_BYTES} limit`,
        code: "FILE_TOO_LARGE",
      },
      { status: 413 }
    );
  }

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds the ${MAX_FILE_SIZE_BYTES} limit`,
        code: "FILE_TOO_LARGE",
      },
      { status: 413 }
    );
  }

  try {
    await writeLocalObject(storageKey, new Uint8Array(bytes));
    return NextResponse.json({ ok: true, storageKey }, { status: 200 });
  } catch (err) {
    console.error("Local dev storage write error:", err);
    return NextResponse.json(
      { error: "Failed to persist uploaded object", code: "STORAGE_WRITE_FAILED" },
      { status: 500 }
    );
  }
}

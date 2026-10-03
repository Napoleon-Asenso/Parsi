"use client";

import { ChangeEvent, DragEvent, KeyboardEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
  normalizeMimeType,
} from "@/lib/utils";

/**
 * The four sequential stages of the direct-to-storage upload handshake.
 * Mirrors the exact flow in `handleFile` below: presign -> PUT -> register -> navigate.
 */
const UPLOAD_STEPS = [
  {
    title: "Requesting a secure upload link",
    detail: "Validating the file type and size with our server",
  },
  {
    title: "Uploading the document",
    detail: "Streaming bytes straight to encrypted object storage",
  },
  {
    title: "Registering the processing job",
    detail: "Handing the document to the background queue",
  },
  {
    title: "Opening the processing view",
    detail: "Setting up live status tracking",
  },
] as const;

export default function UploadDropzone() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsUploading(false);
    setActiveStep(-1);
    setNoticeMessage("Upload was cancelled.");
  };

  const handleFile = async (file: File) => {
    if (isUploading) return;

    setErrorMessage(null);
    setNoticeMessage(null);

    // 1. Client-side type validation (mirrors the server-side allowlist)
    const mimeType = normalizeMimeType(file.type);
    if (!mimeType) {
      setErrorMessage(
        `"${file.name}" is not a supported file type. Upload a JPEG, PNG, or PDF.`
      );
      return;
    }

    // 2. Client-side size validation (10 MB cap)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(
        `This file is ${(file.size / (1024 * 1024)).toFixed(2)} MB — the limit is ${MAX_FILE_SIZE_LABEL}.`
      );
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setIsUploading(true);
    setActiveStep(0);

    try {
      // Step 1: POST /api/upload/presigned-url
      const presignedRes = await fetch("/api/upload/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          fileName: file.name,
          fileType: mimeType,
          fileSize: file.size,
        }),
      });

      if (!presignedRes.ok) {
        const errData = await presignedRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate presigned upload URL");
      }

      const { uploadUrl, storageKey } = await presignedRes.json();

      // Step 2: Direct binary PUT to Cloudflare R2
      setActiveStep(1);
      const r2Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mimeType,
        },
        signal,
        body: file,
      });

      if (!r2Res.ok) {
        throw new Error(`Storage upload failed with status ${r2Res.status}`);
      }

      // Step 3: POST /api/jobs with metadata
      setActiveStep(2);
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          storageKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType,
        }),
      });

      if (!jobRes.ok) {
        const errData = await jobRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create processing job");
      }

      const { jobId } = await jobRes.json();

      // Step 4: Immediate redirection to Screen 2
      setActiveStep(3);
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User aborted upload
        setIsUploading(false);
        setActiveStep(-1);
        setNoticeMessage("Upload was cancelled.");
        return;
      }
      console.error("Upload workflow error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during upload."
      );
      setIsUploading(false);
      setActiveStep(-1);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const openFilePicker = () => {
    if (!isUploading) fileInputRef.current?.click();
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Single-file processing only — first file wins, and we say so.
    if (files.length > 1) {
      setNoticeMessage(
        "Only the first file was used — this pipeline processes one document at a time."
      );
    }
    handleFile(files[0]);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Allow re-selecting the same file after a failure.
      e.target.value = "";
      handleFile(file);
    }
  };

  const onDropzoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  };

  const progressPercent = isUploading
    ? Math.round(((activeStep + 1) / UPLOAD_STEPS.length) * 100)
    : 0;

  return (
    <section className="animate-fade-up w-full">
      <div className="card p-6 sm:p-10">
        {/* ---------------- Header ---------------- */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Receipts in. Structured data out.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-on-surface-variant">
            Drop a single receipt, invoice, or PDF. We transcribe it, extract the
            fields, and validate everything against a strict schema.
          </p>
        </div>

        {/* ---------------- Dropzone / Progress ---------------- */}
        {isUploading ? (
          <div
            className="card-inset animate-fade-in p-6 md:p-8"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold">
                    {UPLOAD_STEPS[activeStep]?.title ?? "Working…"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {UPLOAD_STEPS[activeStep]?.detail ?? ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold tabular-nums text-on-surface-variant">
                  {progressPercent}%
                </span>
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="btn btn-secondary px-3 py-1 text-xs"
                  aria-label="Cancel upload"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="progress-track mt-5">
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                aria-label="Upload progress"
              />
            </div>

            <ol className="mt-6 grid gap-2.5">
              {UPLOAD_STEPS.map((step, index) => {
                const state =
                  index < activeStep
                    ? "done"
                    : index === activeStep
                      ? "active"
                      : "todo";
                return (
                  <li
                    key={step.title}
                    className="flex items-center gap-3 text-xs"
                  >
                    {state === "done" ? (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-token-full bg-primary text-on-primary"
                        aria-hidden="true"
                      >
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                      </span>
                    ) : state === "active" ? (
                      <span
                        className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="h-5 w-5 shrink-0 rounded-token-full border-2 border-outline-variant"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={
                        state === "todo"
                          ? "text-on-surface-variant"
                          : "font-medium text-on-surface"
                      }
                    >
                      {step.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <div
            id="dropzone"
            role="button"
            tabIndex={0}
            aria-label="Upload a document. Press Enter to browse files, or drag and drop a file here."
            aria-disabled={isUploading}
            onClick={openFilePicker}
            onKeyDown={onDropzoneKeyDown}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className="group relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-token-lg border-2 border-dashed p-8 text-center transition-all duration-200 md:p-12"
            style={{
              borderColor: isDragging
                ? "var(--color-primary-color)"
                : "var(--color-outline-variant-color)",
              backgroundColor: isDragging
                ? "var(--color-surface-container-low-color)"
                : "var(--color-surface-container-lowest-color)",
              transform: isDragging ? "scale(1.01)" : undefined,
            }}
          >
            {isDragging && (
              <span
                className="pointer-events-none absolute inset-0 rounded-token-lg bg-primary"
                style={{ opacity: 0.04 }}
                aria-hidden="true"
              />
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MIME_TYPES.join(",")}
              className="sr-only"
              onChange={onFileInputChange}
              disabled={isUploading}
              tabIndex={-1}
              aria-hidden="true"
            />

            {/* Icon */}
            <span
              className="icon-tile icon-tile-primary h-16 w-16 rounded-token-lg transition-transform duration-200 group-hover:scale-105"
              aria-hidden="true"
            >
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              </svg>
            </span>

            <p className="mt-5 text-base font-semibold">
              {isDragging
                ? "Release to upload"
                : "Drag & drop your document here"}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              or{" "}
              <span className="font-semibold text-primary underline-offset-4 group-hover:underline">
                browse your files
              </span>
            </p>

            {/* Format chips */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {["JPEG", "PNG", "PDF"].map((format) => (
                <span key={format} className="chip">
                  {format}
                </span>
              ))}
              <span className="chip">Up to {MAX_FILE_SIZE_LABEL}</span>
              <span className="chip">PDF · first page only</span>
            </div>
          </div>
        )}

        {/* ---------------- Feedback ---------------- */}
        {noticeMessage && !isUploading && (
          <div className="alert alert-info mt-4 animate-fade-in" role="status">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <p className="leading-relaxed">{noticeMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="alert alert-error mt-4 animate-fade-in" role="alert">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold">Upload failed</p>
              <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="shrink-0 rounded-token-sm px-2 py-1 text-xs font-semibold underline underline-offset-2 transition-opacity hover:opacity-75"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

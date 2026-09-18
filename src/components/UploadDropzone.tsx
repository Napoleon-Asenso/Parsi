"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "@/lib/s3";

export default function UploadDropzone() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErrorMessage(null);

    // 1. Client-side Size validation (10 MB cap)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(
        `File exceeds ${MAX_FILE_SIZE_LABEL} limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`
      );
      return;
    }

    setIsUploading(true);
    setUploadStatus("Requesting upload signature...");

    try {
      // Step 1: POST /api/upload/presigned-url
      const presignedRes = await fetch("/api/upload/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignedRes.ok) {
        const errData = await presignedRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate presigned upload URL");
      }

      const { uploadUrl, storageKey } = await presignedRes.json();

      // Step 2: Direct Binary PUT to S3
      setUploadStatus("Uploading document directly to storage...");
      const s3Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!s3Res.ok) {
        throw new Error(`S3 direct upload failed with status ${s3Res.status}`);
      }

      // Step 3: POST /api/jobs with metadata
      setUploadStatus("Registering processing job...");
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      if (!jobRes.ok) {
        const errData = await jobRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create processing job");
      }

      const { jobId } = await jobRes.json();

      // Step 4: Immediate redirection to Screen 2
      setUploadStatus("Redirecting to processing view...");
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      console.error("Upload workflow error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred during upload."
      );
      setIsUploading(false);
      setUploadStatus("");
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Single-file processing only
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  return (
    <div className="surface-card p-8 md:p-12 w-full text-center">
      <div className="mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold mb-2 tracking-tight"
          style={{ color: "var(--color-on-surface-color)" }}
        >
          Document &amp; Receipt Parser
        </h1>
        <p
          className="text-sm md:text-base"
          style={{ color: "var(--color-on-surface-variant-color)" }}
        >
          Upload any document or image to transcribe &mdash; PDF, Word, Markdown, plain text,
          spreadsheets or pictures &mdash; up to {MAX_FILE_SIZE_LABEL}. Page count is unlimited.
        </p>
      </div>

      <div
        id="dropzone"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{
          borderColor: isDragging
            ? "var(--color-primary-color)"
            : "var(--color-outline-variant-color)",
          backgroundColor: isDragging
            ? "var(--color-surface-container-high-color)"
            : "var(--color-surface-container-low-color)",
          borderRadius: "var(--border-radius-radius-md)",
          transition: "all 0.2s ease",
          cursor: isUploading ? "not-allowed" : "pointer",
        }}
        className="border-2 border-dashed p-10 md:p-16 flex flex-col items-center justify-center min-h-[260px]"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          className="hidden"
          onChange={onFileInputChange}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center">
            <div
              className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-4"
              style={{
                borderColor: "var(--color-primary-color)",
                borderTopColor: "transparent",
              }}
            />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-primary-color)" }}
            >
              {uploadStatus}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg
              className="w-14 h-14 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: "var(--color-primary-color)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p
              className="text-base font-semibold mb-1"
              style={{ color: "var(--color-on-surface-color)" }}
            >
              Drag and drop your document or image here
            </p>
            <p
              className="text-xs mb-4"
              style={{ color: "var(--color-on-surface-variant-color)" }}
            >
              or click to browse from your computer
            </p>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-xs"
              tabIndex={-1}
            >
              Select Single Document
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div
          className="mt-4 p-3 text-xs text-left"
          style={{
            backgroundColor: "var(--status-error-surface)",
            color: "var(--status-error-text)",
            border: "1px solid var(--status-error-border)",
            borderRadius: "var(--border-radius-radius-md)",
          }}
        >
          <strong>Upload Error: </strong>
          {errorMessage}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between text-xs" style={{ color: "var(--color-on-surface-variant-color)" }}>
        <span>Direct S3 Presigned Upload</span>
        <span>Strict Zod Validation</span>
        <span>Concurrently Throttled Worker</span>
      </div>
    </div>
  );
}

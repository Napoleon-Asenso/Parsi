"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobRecord, JobStatusValue } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_SECONDS = 60;

const STATUS_LABEL: Record<JobStatusValue, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  DONE: "Done",
  FAILED: "Failed",
};

const STATUS_BADGE_CLASS: Record<JobStatusValue, string> = {
  PENDING: "badge-pending",
  PROCESSING: "badge-processing",
  DONE: "badge-done",
  FAILED: "badge-failed",
};

/** Pipeline stages visible to the user. Index 0 is always complete on arrival. */
const STAGES = [
  {
    label: "Upload accepted",
    detail: "Document stored securely",
  },
  {
    label: "Queued for a worker",
    detail: "Waiting for an available slot (3 concurrent max)",
  },
  {
    label: "Extracting & validating",
    detail: "Transcribing content and checking the schema",
  },
] as const;

interface ProcessingViewProps {
  jobId: string;
  onComplete: (job: JobRecord) => void;
}

export default function ProcessingView({ jobId, onComplete }: ProcessingViewProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobRecord | null>(null);
  const [status, setStatus] = useState<JobStatusValue>("PENDING");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isTerminalRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    isTerminalRef.current = false;
    const startedAt = Date.now();
    let cancelled = false;

    const pollTimer: { current: ReturnType<typeof setInterval> | null } = { current: null };
    const clockTimer: { current: ReturnType<typeof setInterval> | null } = { current: null };

    const clearTimers = () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (clockTimer.current) clearInterval(clockTimer.current);
      pollTimer.current = null;
      clockTimer.current = null;
    };

    const poll = async () => {
      if (isTerminalRef.current) return;
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });

        if (res.status === 404) {
          if (cancelled) return;
          isTerminalRef.current = true;
          setFetchError(`No processing job found for ID "${jobId}".`);
          clearTimers();
          return;
        }

        if (!res.ok) {
          throw new Error(`Status check failed with HTTP ${res.status}`);
        }

        const data: JobRecord = await res.json();
        if (cancelled) return;

        setJob(data);
        setStatus(data.status);
        setErrorMessage(data.errorMessage);
        setFetchError(null);

        if (data.status === "DONE") {
          isTerminalRef.current = true;
          clearTimers();
          onCompleteRef.current(data);
        } else if (data.status === "FAILED") {
          isTerminalRef.current = true;
          clearTimers();
        }
      } catch (err) {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : "Unable to reach the processing service.");
      }
    };

    poll();
    pollTimer.current = setInterval(poll, POLL_INTERVAL_MS);
    clockTimer.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(seconds);
      if (seconds >= TIMEOUT_SECONDS && !isTerminalRef.current) {
        isTerminalRef.current = true;
        setTimedOut(true);
        clearTimers();
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [jobId]);

  const badgeClass = STATUS_BADGE_CLASS[status];

  const renderBadge = () => (
    <span className={`badge ${badgeClass}`}>
      <span className="badge-dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );

  const resetToUpload = () => router.push("/");

  /* ------------------------------------------------------------------ */
  /*  Timeout state                                                      */
  /* ------------------------------------------------------------------ */

  if (timedOut) {
    return (
      <section className="animate-fade-up w-full">
        <div className="card p-8 text-center md:p-12">
          <span className="icon-tile icon-tile-warning mx-auto h-14 w-14 rounded-token-full">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>

          <h1 className="mt-5 text-xl font-bold tracking-tight md:text-2xl">
            Taking longer than expected
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-on-surface-variant">
            The document didn&apos;t finish processing within {TIMEOUT_SECONDS} seconds,
            so we stopped checking. The job may still complete in the background —
            you&apos;re welcome to try again.
          </p>

          <div className="mt-7 flex justify-center">
            <button
              type="button"
              className="btn btn-primary w-full sm:w-auto"
              onClick={resetToUpload}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 2.6-6.4" />
                <path d="M3 4v5h5" />
              </svg>
              Retry Upload
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Failure state                                                      */
  /* ------------------------------------------------------------------ */

  if (status === "FAILED" || fetchError) {
    return (
      <section className="animate-fade-up w-full">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 md:px-8">
            <div className="flex items-center gap-3">
              <span className="icon-tile icon-tile-error h-9 w-9">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </svg>
              </span>
              <h1 className="text-lg font-bold tracking-tight md:text-xl">
                We couldn&apos;t parse this document
              </h1>
            </div>
            {renderBadge()}
          </div>

          <div className="px-6 pb-6 md:px-8 md:pb-8">
            <div className="alert alert-error" role="alert">
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
              <div>
                <p className="font-semibold">Diagnostic detail</p>
                <p className="mt-0.5 break-words leading-relaxed">
                  {errorMessage || fetchError || "An unknown error occurred."}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <div className="card-inset p-3">
                <dt className="text-on-surface-variant">Job ID</dt>
                <dd className="mt-1 break-all font-mono text-[11px]">{jobId}</dd>
              </div>
              <div className="card-inset p-3">
                <dt className="text-on-surface-variant">Attempts</dt>
                <dd className="mt-1 font-mono text-[11px]">{job?.attempts ?? 0}</dd>
              </div>
            </dl>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={resetToUpload}
              >
                Upload Another Receipt
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Active processing state                                            */
  /* ------------------------------------------------------------------ */

  const stageIndex = status === "PENDING" ? 1 : 2;
  const progressPercent = Math.min(
    Math.round((elapsedSeconds / TIMEOUT_SECONDS) * 100),
    100
  );

  return (
    <section className="animate-fade-up w-full">
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 md:px-8">
          <div className="flex items-center gap-3">
            {renderBadge()}
            <span className="font-mono text-[11px] text-on-surface-variant">
              {jobId.slice(0, 8)}…
            </span>
          </div>
          <span className="text-xs font-medium tabular-nums text-on-surface-variant">
            {Math.min(elapsedSeconds, TIMEOUT_SECONDS)}s of {TIMEOUT_SECONDS}s
          </span>
        </div>

        <div className="px-6 pb-6 md:px-8 md:pb-8">
          {/* Scanning visual + status copy */}
          <div className="flex flex-col items-center text-center">
            <div
              className="relative flex items-center justify-center py-4"
              aria-hidden="true"
            >
              <div
                className="absolute h-36 w-36 rounded-token-full blur-3xl"
                style={{
                  backgroundColor: "var(--color-primary-container-color)",
                  opacity: 0.45,
                }}
              />
              <div className="scan-surface relative flex h-40 w-32 flex-col gap-2.5 rounded-token-md border border-outline-variant bg-container-lowest p-4 shadow-token-lg">
                <div className="h-2 w-12 rounded-token-full bg-container-highest" />
                <div className="h-2 w-20 rounded-token-full bg-container-high" />
                <div className="h-2 w-16 rounded-token-full bg-container-high" />
                <div className="mt-auto space-y-2">
                  <div className="h-2 w-20 rounded-token-full bg-container-high" />
                  <div
                    className="h-2 w-24 rounded-token-full bg-primary"
                    style={{ opacity: 0.4 }}
                  />
                </div>
                <div className="scanline" />
              </div>
            </div>

            <h1 className="mt-5 text-xl font-bold tracking-tight md:text-2xl">
              {status === "PENDING"
                ? "Waiting for an available worker"
                : "Reading and validating your document"}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-on-surface-variant">
              {status === "PENDING"
                ? "Your document is queued. Processing starts automatically as soon as a worker slot frees up."
                : "The AI worker is transcribing the content and checking every field against the schema."}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              This page updates automatically every 2 seconds — feel free to leave it open.
            </p>
          </div>

          {/* Elapsed progress */}
          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between text-xs text-on-surface-variant">
              <span>Elapsed</span>
              <span className="tabular-nums">
                {Math.min(elapsedSeconds, TIMEOUT_SECONDS)}s / {TIMEOUT_SECONDS}s
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={TIMEOUT_SECONDS}
              aria-valuenow={Math.min(elapsedSeconds, TIMEOUT_SECONDS)}
              aria-label="Elapsed processing time"
            >
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Stage tracker */}
          <ol className="mt-6 grid gap-2.5">
            {STAGES.map((stage, index) => {
              const state =
                index < stageIndex ? "done" : index === stageIndex ? "active" : "todo";
              return (
                <li
                  key={stage.label}
                  className="flex items-start gap-3 rounded-token-md border border-outline-variant bg-container-low px-4 py-3"
                  style={
                    state === "active"
                      ? { borderColor: "var(--status-info-border)" }
                      : undefined
                  }
                >
                  {state === "done" ? (
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-token-full bg-primary text-on-primary"
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
                      className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-info-text border-t-transparent"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="mt-0.5 h-5 w-5 shrink-0 rounded-token-full border-2 border-outline-variant"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p
                      className={
                        state === "todo"
                          ? "text-xs font-medium text-on-surface-variant"
                          : "text-xs font-semibold"
                      }
                    >
                      {stage.label}
                      {state === "active" ? " — in progress" : ""}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      {stage.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Job meta */}
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="card-inset p-3">
              <dt className="text-[11px] text-on-surface-variant">Job ID</dt>
              <dd className="mt-1 break-all font-mono text-[11px]">{jobId}</dd>
            </div>
            <div className="card-inset p-3">
              <dt className="text-[11px] text-on-surface-variant">Attempts</dt>
              <dd className="mt-1 font-mono text-[11px]">{job?.attempts ?? 0}</dd>
            </div>
            {job?.file && (
              <>
                <div className="card-inset p-3">
                  <dt className="text-[11px] text-on-surface-variant">File</dt>
                  <dd className="mt-1 truncate text-[11px] font-medium" title={job.file.fileName}>
                    {job.file.fileName}
                  </dd>
                </div>
                <div className="card-inset p-3">
                  <dt className="text-[11px] text-on-surface-variant">Size</dt>
                  <dd className="mt-1 text-[11px] font-medium">
                    {formatFileSize(job.file.fileSize)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}

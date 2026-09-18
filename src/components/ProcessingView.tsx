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
    <span
      className={`${badgeClass} inline-flex items-center px-3 py-1 text-xs font-semibold`}
      style={{ borderRadius: "var(--border-radius-radius-full)" }}
    >
      {STATUS_LABEL[status]}
    </span>
  );

  const resetToUpload = () => router.push("/");

  if (timedOut) {
    return (
      <div className="surface-card p-8 md:p-12 w-full text-center">
        <div
          className="mx-auto mb-4 flex items-center justify-center w-14 h-14"
          style={{
            borderRadius: "var(--border-radius-radius-full)",
            backgroundColor: "var(--status-warning-surface)",
            color: "var(--status-warning-text)",
          }}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl md:text-2xl font-bold mb-2" style={{ color: "var(--color-on-surface-color)" }}>
          Processing Timed Out
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-on-surface-variant-color)" }}>
          The document did not finish processing within {TIMEOUT_SECONDS} seconds. You can retry the upload.
        </p>
        <button type="button" className="btn-primary px-5 py-2.5 text-sm" onClick={resetToUpload}>
          Retry Upload
        </button>
      </div>
    );
  }

  if (status === "FAILED" || fetchError) {
    return (
      <div className="surface-card p-8 md:p-12 w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: "var(--color-on-surface-color)" }}>
            Processing Failed
          </h1>
          {renderBadge()}
        </div>
        <div
          className="p-4 mb-6 text-left text-sm"
          style={{
            backgroundColor: "var(--status-error-surface)",
            color: "var(--status-error-text)",
            border: "1px solid var(--status-error-border)",
            borderRadius: "var(--border-radius-radius-md)",
          }}
        >
          <p className="font-semibold mb-1">Diagnostic detail</p>
          <p className="break-words">{errorMessage || fetchError || "An unknown error occurred."}</p>
        </div>
        <button type="button" className="btn-primary px-5 py-2.5 text-sm" onClick={resetToUpload}>
          Upload Another Document
        </button>
      </div>
    );
  }

  return (
    <div className="surface-card p-8 md:p-12 w-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: "var(--color-on-surface-color)" }}>
          Processing Document
        </h1>
        {renderBadge()}
      </div>

      <div className="flex flex-col items-center text-center py-6">
        <div
          className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mb-5"
          style={{ borderColor: "var(--color-primary-color)", borderTopColor: "transparent" }}
        />
        <p className="text-base font-semibold mb-1" style={{ color: "var(--color-on-surface-color)" }}>
          {status === "PENDING" ? "Queued for processing" : "Transcribing and extracting document data"}
        </p>
        <p className="text-xs" style={{ color: "var(--color-on-surface-variant-color)" }}>
          The document is being verified and transcribed by the AI worker. This page updates automatically.
        </p>
      </div>

      <div className="surface-low p-4 mt-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs" style={{ color: "var(--color-on-surface-variant-color)" }}>
              Job ID
            </dt>
            <dd className="font-mono text-xs break-all" style={{ color: "var(--color-on-surface-color)" }}>
              {jobId}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--color-on-surface-variant-color)" }}>
              Attempts
            </dt>
            <dd className="font-mono text-xs" style={{ color: "var(--color-on-surface-color)" }}>
              {job?.attempts ?? 0}
            </dd>
          </div>
          {job?.file && (
            <>
              <div>
                <dt className="text-xs" style={{ color: "var(--color-on-surface-variant-color)" }}>
                  File
                </dt>
                <dd className="text-xs break-all" style={{ color: "var(--color-on-surface-color)" }}>
                  {job.file.fileName}
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--color-on-surface-variant-color)" }}>
                  Size
                </dt>
                <dd className="text-xs" style={{ color: "var(--color-on-surface-color)" }}>
                  {formatFileSize(job.file.fileSize)}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs mb-2" style={{ color: "var(--color-on-surface-variant-color)" }}>
          <span>Elapsed</span>
          <span>
            {Math.min(elapsedSeconds, TIMEOUT_SECONDS)}s / {TIMEOUT_SECONDS}s
          </span>
        </div>
        <div
          className="w-full h-1.5 overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface-container-high-color)",
            borderRadius: "var(--border-radius-radius-full)",
          }}
        >
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${Math.min((elapsedSeconds / TIMEOUT_SECONDS) * 100, 100)}%`,
              backgroundColor: "var(--color-primary-color)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

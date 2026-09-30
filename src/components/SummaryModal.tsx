"use client";

import { useEffect, useRef } from "react";

interface SummaryModalProps {
  open: boolean;
  summary: string | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
  onClose: () => void;
  onRetry?: () => void;
}

export default function SummaryModal({
  open,
  summary,
  loading,
  error,
  cached,
  onClose,
  onRetry,
}: SummaryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        className="animate-fade-in absolute inset-0 backdrop-blur-sm"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-inverse-surface-color) 45%, transparent)",
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-modal-title"
        className="card animate-scale-in relative w-full max-w-xl rounded-b-none rounded-t-token-xl p-6 sm:rounded-token-xl md:p-8"
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="icon-tile icon-tile-primary h-10 w-10">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3v3M18.36 5.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 18v3M7.76 16.24l-2.12 2.12M6 12H3M7.76 7.76 5.64 5.64" />
              </svg>
            </span>
            <div>
              <h2
                id="summary-modal-title"
                className="text-lg font-bold tracking-tight"
              >
                Executive Summary
              </h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Two-sentence AI overview of this document
              </p>
              {cached && !loading && (
                <span className="chip mt-2">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
                  </svg>
                  Cached result — no new AI call
                </span>
              )}
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close summary"
            className="btn btn-secondary h-9 min-h-0 w-9 shrink-0 rounded-token-full p-0"
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div aria-live="polite" className="py-2">
            <div className="space-y-3">
              <div className="skeleton h-3.5 w-full" />
              <div className="skeleton h-3.5 w-11/12" />
              <div className="skeleton h-3.5 w-4/5" />
            </div>
            <p className="mt-4 text-xs text-on-surface-variant">
              Drafting your summary…
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
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
            <div className="flex-1">
              <p className="font-semibold">Couldn&apos;t generate a summary</p>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Summary */}
        {!loading && !error && summary && (
          <p className="whitespace-pre-wrap border-l-2 border-primary pl-4 text-sm leading-relaxed">
            {summary}
          </p>
        )}

        {/* Empty */}
        {!loading && !error && !summary && (
          <p className="text-sm text-on-surface-variant">
            No summary available yet.
          </p>
        )}

        {/* Footer */}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {!loading && error && onRetry && (
            <button type="button" className="btn btn-primary" onClick={onRetry}>
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
              Try Again
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

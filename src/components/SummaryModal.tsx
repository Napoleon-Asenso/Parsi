"use client";

interface SummaryModalProps {
  open: boolean;
  summary: string | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
  onClose: () => void;
}

export default function SummaryModal({
  open,
  summary,
  loading,
  error,
  cached,
  onClose,
}: SummaryModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--color-inverse-surface-color)", opacity: 0.4 }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Executive document summary"
        className="surface-card relative w-full max-w-lg p-6 md:p-8"
        style={{ zIndex: 1 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--color-on-surface-color)" }}>
              Executive Document Summary
            </h2>
            {cached && !loading && (
              <span className="text-xs" style={{ color: "var(--color-on-surface-variant-color)" }}>
                Cached result
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close summary"
            className="btn-secondary w-8 h-8 flex items-center justify-center text-base leading-none"
          >
            &times;
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center py-8">
            <div
              className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-4"
              style={{ borderColor: "var(--color-primary-color)", borderTopColor: "transparent" }}
            />
            <p className="text-sm" style={{ color: "var(--color-on-surface-variant-color)" }}>
              Generating summary...
            </p>
          </div>
        )}

        {!loading && error && (
          <div
            className="p-4 text-sm"
            style={{
              backgroundColor: "var(--status-error-surface)",
              color: "var(--status-error-text)",
              border: "1px solid var(--status-error-border)",
              borderRadius: "var(--border-radius-radius-md)",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && summary && (
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--color-on-surface-color)" }}
          >
            {summary}
          </p>
        )}

        {!loading && !error && !summary && (
          <p className="text-sm" style={{ color: "var(--color-on-surface-variant-color)" }}>
            No summary available.
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

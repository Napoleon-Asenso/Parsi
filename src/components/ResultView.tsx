"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SummaryModal from "@/components/SummaryModal";
import type { JobRecord } from "@/lib/utils";
import { formatCurrency, formatDate, formatFileSize } from "@/lib/utils";

interface ResultViewProps {
  job: JobRecord;
}

export default function ResultView({ job }: ResultViewProps) {
  const router = useRouter();
  const receipt = job.resultJson;

  const [summary, setSummary] = useState<string | null>(job.summaryText);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryCached, setSummaryCached] = useState(Boolean(job.summaryText));

  const requestSummary = async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/summarize`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate expense summary");
      }
      setSummary(data.summary);
      setSummaryCached(Boolean(data.cached));
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : "Failed to generate expense summary"
      );
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleSummarize = () => {
    setIsModalOpen(true);
    if (summary) {
      setSummaryCached(true);
      return;
    }
    void requestSummary();
  };

  const lineItems = receipt?.lineItems ?? [];
  const transcription = receipt?.transcription?.trim() ?? "";
  const totalAmount = receipt?.totalAmount ?? null;

  const detailFields = [
    { label: "Merchant Name", value: receipt?.merchantName ?? "Unknown Merchant" },
    { label: "Transaction Date", value: formatDate(receipt?.transactionDate) },
    { label: "Currency", value: receipt?.currency ?? "USD" },
    {
      label: "Tax Amount",
      value:
        receipt?.taxAmount === null || receipt?.taxAmount === undefined
          ? "Not found"
          : formatCurrency(receipt.taxAmount, receipt.currency),
    },
    { label: "Category", value: receipt?.category ?? "General" },
    { label: "Document Type", value: receipt?.documentType ?? "Unknown Document" },
  ];

  return (
    <div className="w-full">
      {/* ---------------- Result header ---------------- */}
      <section className="card animate-fade-up p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="icon-tile icon-tile-success h-12 w-12">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                Parsed successfully
              </h1>
              {job.file && (
                <p className="mt-1 text-xs text-on-surface-variant">
                  {job.file.fileName} · {formatFileSize(job.file.fileSize)}
                </p>
              )}
            </div>
          </div>
          <span className="badge badge-done">
            <span className="badge-dot" aria-hidden="true" />
            Done
          </span>
        </div>

        {/* Extracted fields */}
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {/* Total amount — deliberately the loudest element on the page */}
          <div
            className="col-span-2 flex flex-col justify-between gap-3 rounded-token-md p-4 md:col-span-3 md:flex-row md:items-center md:p-5"
            style={{
              backgroundColor: "var(--color-primary-container-color)",
              color: "var(--color-on-primary-container-color)",
            }}
          >
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                Total Amount
              </dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
                {totalAmount !== null
                  ? formatCurrency(totalAmount, receipt?.currency)
                  : "Not found"}
              </dd>
            </div>
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-token-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M14.5 9a2.5 2.5 0 0 0-2.5-2h-.5a2.5 2.5 0 0 0 0 5h1a2.5 2.5 0 0 1 0 5H12a2.5 2.5 0 0 1-2.5-2M12 5.5v13" />
              </svg>
              {receipt?.currency ?? "USD"}
            </span>
          </div>

          {detailFields.map((field) => (
            <div key={field.label} className="card-inset p-4">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
                {field.label}
              </dt>
              <dd className="mt-1.5 break-words text-sm font-semibold">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------- Line items ---------------- */}
      <section className="card animate-fade-up delay-1 mt-5 overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 md:px-8">
          <h2 className="text-base font-bold tracking-tight">Line Items</h2>
          <span className="chip">
            {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
          </span>
        </header>

        {lineItems.length === 0 ? (
          <div className="flex flex-col items-center px-6 pb-10 pt-2 text-center md:px-8">
            <span className="icon-tile icon-tile-muted rounded-token-full">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 12h6" />
              </svg>
            </span>
            <p className="mt-3 text-sm font-semibold">No line items extracted</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-on-surface-variant">
              This document doesn&apos;t appear to be itemised, or no readable lines
              were found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={`${item.description}-${index}`}>
                    <td className="font-medium">{item.description}</td>
                    <td className="text-right tabular-nums text-on-surface-variant">
                      {item.quantity ?? "—"}
                    </td>
                    <td className="text-right tabular-nums text-on-surface-variant">
                      {item.unitPrice === null || item.unitPrice === undefined
                        ? "—"
                        : formatCurrency(item.unitPrice, receipt?.currency)}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {formatCurrency(item.totalPrice, receipt?.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------- Transcription (progressive disclosure) ---------------- */}
      <details className="card animate-fade-up delay-2 mt-5 overflow-hidden">
        <summary className="details-summary">
          <span className="icon-tile icon-tile-muted h-9 w-9">
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
              <path d="M4 6h16M4 10h16M4 14h10M4 18h7" />
            </svg>
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">Original transcription</span>
            <span className="block text-xs text-on-surface-variant">
              Verbatim text pulled from the document
            </span>
          </span>
          <svg
            className="details-chevron h-4 w-4 text-on-surface-variant"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>

        <div className="px-6 pb-6 pt-4 md:px-8">
          {transcription ? (
            <pre className="card-inset max-h-80 overflow-y-auto whitespace-pre-wrap break-words p-4 font-sans text-[13px] leading-relaxed">
              {transcription}
            </pre>
          ) : (
            <p className="text-sm text-on-surface-variant">
              No readable text was transcribed from this document.
            </p>
          )}
        </div>
      </details>

      {/* ---------------- Validated JSON (progressive disclosure) ---------------- */}
      <details className="card animate-fade-up delay-3 mt-5 overflow-hidden">
        <summary className="details-summary">
          <span className="icon-tile icon-tile-muted h-9 w-9">
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
              <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
            </svg>
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">
              Zod-validated JSON
            </span>
            <span className="block text-xs text-on-surface-variant">
              The exact structured payload saved to the database
            </span>
          </span>
          <svg
            className="details-chevron h-4 w-4 text-on-surface-variant"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>

        <div className="px-6 pb-6 pt-4 md:px-8">
          <pre className="card-inset max-h-80 overflow-auto p-4 font-mono text-[11px] leading-relaxed">
            {JSON.stringify(receipt, null, 2)}
          </pre>
        </div>
      </details>

      {/* ---------------- Sticky action bar ---------------- */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant backdrop-blur-md"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-background-color) 86%, transparent)",
        }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col-reverse gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <span className="hidden font-mono text-[11px] text-on-surface-variant sm:block">
            Job {job.id.slice(0, 8)}…
          </span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/")}
            >
              Upload Another Receipt
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSummarize}
              disabled={isLoadingSummary}
            >
              {isLoadingSummary ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
              ) : (
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
                  <path d="M12 3v3M18.36 5.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 18v3M7.76 16.24l-2.12 2.12M6 12H3M7.76 7.76 5.64 5.64" />
                </svg>
              )}
              {isLoadingSummary
                ? "Generating…"
                : summary
                  ? "View Summary"
                  : "Summarize Expense"}
            </button>
          </div>
        </div>
      </div>

      <SummaryModal
        open={isModalOpen}
        summary={summary}
        loading={isLoadingSummary}
        error={summaryError}
        cached={summaryCached}
        onClose={() => setIsModalOpen(false)}
        onRetry={() => void requestSummary()}
      />
    </div>
  );
}

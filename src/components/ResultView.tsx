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

  const handleSummarize = async () => {
    setIsModalOpen(true);
    setSummaryError(null);

    if (summary) {
      setSummaryCached(true);
      return;
    }

    setIsLoadingSummary(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/summarize`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate expense summary");
      }
      setSummary(data.summary);
      setSummaryCached(Boolean(data.cached));
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to generate expense summary");
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const headerFields = [
    { label: "Document Type", value: receipt?.documentType ?? "Unknown Document" },
    { label: "Merchant Name", value: receipt?.merchantName ?? "Unknown Merchant" },
    { label: "Transaction Date", value: formatDate(receipt?.transactionDate) },
    {
      label: "Total Amount",
      value:
        receipt?.totalAmount === null || receipt?.totalAmount === undefined
          ? "N/A"
          : formatCurrency(receipt.totalAmount, receipt.currency),
    },
    { label: "Currency", value: receipt?.currency ?? "USD" },
    {
      label: "Tax Amount",
      value:
        receipt?.taxAmount === null || receipt?.taxAmount === undefined
          ? "N/A"
          : formatCurrency(receipt.taxAmount, receipt.currency),
    },
    { label: "Category", value: receipt?.category ?? "General" },
  ];

  const lineItems = receipt?.lineItems ?? [];
  const transcription = receipt?.transcription?.trim() ?? "";

  return (
    <div className="w-full space-y-6">
      <div className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" style={{ color: "var(--color-on-surface-color)" }}>
              Parsed Document
            </h1>
            {job.file && (
              <p className="text-xs mt-1" style={{ color: "var(--color-on-surface-variant-color)" }}>
                {job.file.fileName} &middot; {formatFileSize(job.file.fileSize)}
              </p>
            )}
          </div>
          <span
            className="badge-done inline-flex items-center px-3 py-1 text-xs font-semibold"
            style={{ borderRadius: "var(--border-radius-radius-full)" }}
          >
            Done
          </span>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {headerFields.map((field) => (
            <div
              key={field.label}
              className="surface-low p-4"
            >
              <dt className="text-xs mb-1" style={{ color: "var(--color-on-surface-variant-color)" }}>
                {field.label}
              </dt>
              <dd className="text-sm font-semibold break-words" style={{ color: "var(--color-on-surface-color)" }}>
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="surface-card p-6 md:p-8">
        <h2 className="text-base font-bold mb-4" style={{ color: "var(--color-on-surface-color)" }}>
          Transcription
        </h2>

        {transcription ? (
          <pre
            className="p-4 text-xs whitespace-pre-wrap break-words"
            style={{
              backgroundColor: "var(--color-surface-container-low-color)",
              border: "1px solid var(--color-outline-variant-color)",
              borderRadius: "var(--border-radius-radius-md)",
              color: "var(--color-on-surface-color)",
              fontFamily: "inherit",
            }}
          >
            {transcription}
          </pre>
        ) : (
          <p className="text-sm" style={{ color: "var(--color-on-surface-variant-color)" }}>
            No readable text was transcribed from this document.
          </p>
        )}
      </div>

      <div className="surface-card p-6 md:p-8">
        <h2 className="text-base font-bold mb-4" style={{ color: "var(--color-on-surface-color)" }}>
          Line Items
        </h2>

        {lineItems.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-on-surface-variant-color)" }}>
            No line items were extracted from this document.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-outline-variant-color)" }}>
                  {["Description", "Quantity", "Unit Price", "Line Total"].map((heading) => (
                    <th
                      key={heading}
                      className="text-left py-2 px-3 text-xs font-semibold"
                      style={{ color: "var(--color-on-surface-variant-color)" }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr
                    key={`${item.description}-${index}`}
                    style={{ borderBottom: "1px solid var(--color-outline-variant-color)" }}
                  >
                    <td className="py-2 px-3" style={{ color: "var(--color-on-surface-color)" }}>
                      {item.description}
                    </td>
                    <td className="py-2 px-3" style={{ color: "var(--color-on-surface-color)" }}>
                      {item.quantity ?? "—"}
                    </td>
                    <td className="py-2 px-3" style={{ color: "var(--color-on-surface-color)" }}>
                      {item.unitPrice === null || item.unitPrice === undefined
                        ? "—"
                        : formatCurrency(item.unitPrice, receipt?.currency)}
                    </td>
                    <td className="py-2 px-3 font-medium" style={{ color: "var(--color-on-surface-color)" }}>
                      {formatCurrency(item.totalPrice, receipt?.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="surface-card p-6 md:p-8">
        <details>
          <summary
            className="text-xs font-semibold cursor-pointer"
            style={{ color: "var(--color-on-surface-variant-color)" }}
          >
            Zod-Validated JSON
          </summary>
          <pre
            className="mt-4 p-4 text-xs overflow-x-auto"
            style={{
              backgroundColor: "var(--color-surface-container-low-color)",
              border: "1px solid var(--color-outline-variant-color)",
              borderRadius: "var(--border-radius-radius-md)",
              color: "var(--color-on-surface-color)",
            }}
          >
            {JSON.stringify(receipt, null, 2)}
          </pre>
        </details>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <button
          type="button"
          className="btn-secondary px-5 py-2.5 text-sm"
          onClick={() => router.push("/")}
        >
          Upload Another Document
        </button>
        <button
          type="button"
          className="btn-primary px-5 py-2.5 text-sm"
          onClick={handleSummarize}
          disabled={isLoadingSummary}
        >
          {summary ? "View Summary" : "Summarize Expense"}
        </button>
      </div>

      <SummaryModal
        open={isModalOpen}
        summary={summary}
        loading={isLoadingSummary}
        error={summaryError}
        cached={summaryCached}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

import type { ParsedDocument } from "@/config/ai.config";

/**
 * The only upload MIME types this slice accepts. Enforced server-side by
 * /api/upload/presigned-url and mirrored by the dropzone's `accept` attribute.
 */
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Maps a client-supplied MIME string onto the canonical allowlist, or returns
 * null when the type is not accepted. `image/jpg` is the one common non-standard
 * spelling browsers emit for JPEG, so it is folded into `image/jpeg`.
 */
export function normalizeMimeType(fileType: string | null | undefined): AllowedMimeType | null {
  const normalized = (fileType ?? "").trim().toLowerCase().split(";")[0].trim();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/png") return "image/png";
  if (normalized === "application/pdf") return "application/pdf";
  return null;
}

export type JobStatusValue = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface JobFileRecord {
  id: string;
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  status: JobStatusValue;
  attempts: number;
  errorMessage: string | null;
  resultJson: ParsedDocument | null;
  summaryText: string | null;
  createdAt: string;
  updatedAt: string;
  file?: JobFileRecord;
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

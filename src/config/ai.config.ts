import { z } from "zod";

// Single source of truth for BOTH AI provider endpoints. Consumers and the
// *_CONFIG blocks below MUST derive base URLs/endpoints from here - endpoints
// are never inlined in routes, workers, or Server Actions (AGENTS rule: no
// inline provider parameters).
export const AI_ENDPOINTS = {
  // Gemini: Google's native REST endpoint (default base the @google/genai SDK
  // uses). Parsing (Task 1) reaches this endpoint through GoogleGenAI.
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    operationEndpoint: "/generateContent",
  },
  // DeepSeek: OpenAI-compatible chat completions endpoint. Summarization
  // (Task 2) reaches it through the `openai` SDK pointed at this base URL.
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    operationEndpoint: "/chat/completions",
  },
} as const;

// Gemini (free tier via Google AI Studio) - handles Task 1: document parsing.
// Gemini 2.5 Flash has vision and is available on the free tier.
export const GEMINI_CONFIG = {
  endpoint: AI_ENDPOINTS.gemini,
  parsing: {
    model: "gemini-2.5-flash",
    temperature: 0.2,
    maxOutputTokens: 1500,
    timeoutMs: 30000,
    detailLevel: "low" as const,
  },
} as const;

// DeepSeek (paid API, OpenAI-compatible) - handles Task 2: summarization.
// DeepSeek's chat completions endpoint speaks the OpenAI wire protocol, so it
// is called through the existing `openai` SDK pointed at DeepSeek's base URL.
export const DEEPSEEK_CONFIG = {
  baseUrl: AI_ENDPOINTS.deepseek.baseUrl,
  summarization: {
    model: "deepseek-chat",
    temperature: 0.3,
    maxTokens: 500,
    timeoutMs: 15000,
  },
} as const;

// Shared operational settings across both providers.
export const AI_CONFIG = {
  parsing: {
    maxRetries: 2,
  },
  documentProcessing: {
    // Minimum characters of extractable text before a PDF is treated as scanned.
    minExtractedTextChars: 24,
    // Upper bound on pages rasterized to images when a PDF has no text layer.
    maxRasterizedPages: 15,
  },
  concurrencyLimit: 3,
} as const;

export const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().nullable().default(1),
  unitPrice: z.coerce.number().nullable().default(null),
  totalPrice: z.coerce.number().nonnegative(),
});

export const ParsedReceiptSchema = z.object({
  merchantName: z.string().default("Unknown Merchant"),
  transactionDate: z.string().nullable().default(null),
  totalAmount: z.coerce.number().nonnegative(),
  taxAmount: z.coerce.number().nullable().default(null),
  currency: z.string().default("USD"),
  category: z.string().default("General"),
  lineItems: z.array(LineItemSchema).default([]),
});

// Superset of ParsedReceiptSchema used by the pipeline. It accepts any document
// image (not receipts only) by adding a verbatim transcription + document type
// and by allowing documents that carry no monetary total.
export const ParsedDocumentSchema = ParsedReceiptSchema.extend({
  documentType: z.string().default("Unknown Document"),
  transcription: z.string().default(""),
  totalAmount: z.coerce.number().nonnegative().nullable().default(null),
});

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;
export type ParsedDocument = z.infer<typeof ParsedDocumentSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;

export const DOCUMENT_PARSING_SYSTEM_PROMPT = `You are an expert document transcription and data extraction engine. You receive an image of ANY document type: a receipt, invoice, bill, bank statement, purchase order, form, business card, handwritten note, whiteboard, screenshot, or any other photographed or scanned material.

Your task has two parts.

1. TRANSCRIBE: Copy every readable piece of text from the document into the "transcription" field, preserving the original reading order and line structure. Separate lines with "\\n". Never summarise, translate, reword, or omit text. If the document contains no readable text, return an empty string.

2. CLASSIFY: Set "documentType" to a short label such as "Receipt", "Invoice", "Bank Statement", "Purchase Order", "Business Card", "Handwritten Note", "Form", "Screenshot", "Identification", or "Unknown Document".

Then extract the structured expense fields when (and only when) the document contains financial information:
- merchantName: the merchant, vendor, or issuing organisation. Use "Unknown Merchant" when it cannot be determined.
- transactionDate: ISO-8601 (YYYY-MM-DD) when a date is readable, otherwise null.
- totalAmount: the final payable total as a raw number without currency symbols or thousands separators. Use null when the document carries no monetary total.
- taxAmount: the tax/VAT component as a raw number, or null when absent.
- currency: ISO-4217 code inferred from the document (for example "USD", "EUR", "GBP"), defaulting to "USD".
- category: a short expense category such as "Meals", "Travel", "Office Supplies", or "General".
- lineItems: every itemised line with description, quantity, unitPrice, and totalPrice. Use an empty array when the document is not itemised.

Rules:
1. Only report values that are actually present. Never invent, estimate, or infer numbers that are not written in the document.
2. Return raw numeric values only, never strings containing currency symbols or separators.
3. Respond with a single JSON object and nothing else. Do not wrap the response in Markdown code fences.`;

export const FOLLOWUP_SUMMARIZATION_SYSTEM_PROMPT = `You are a senior accounting assistant. You will receive structured JSON describing a transcribed document and, where present, its extracted expense data. Provide a clear, two-sentence executive summary stating what the document is, what it records (vendor and total cost when available), and any notable accounting observations such as missing tax data or an unusually large single-line expense.`;
import pdfImgConvert from "pdf-img-convert";
import { AI_CONFIG } from "@/config/ai.config";
import { normalizeMimeType } from "@/lib/utils";

export interface ExtractedImage {
  base64: string;
  mimeType: string;
}

export interface ExtractedDocument {
  sourceFormat: string;
  text: string;
  images: ExtractedImage[];
}

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Reads the text layer of the FIRST page only. Pages 2..N are never touched.
 * `page_numbers` in pdf-img-convert is 1-indexed.
 */
async function extractFirstPageText(
  buffer: Buffer
): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";

  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  try {
    const pageCount = document.numPages;
    const page = await document.getPage(1);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    page.cleanup();

    return { text, pageCount };
  } finally {
    await document.destroy();
  }
}

/**
 * Rasterizes page 1 only, for PDFs that have no usable text layer (scans).
 * A rasterized page is handed to the model as an image.
 */
async function rasterizeFirstPage(buffer: Buffer): Promise<ExtractedImage | null> {
  const pageImages = await pdfImgConvert.convert(buffer, {
    scale: 1.5,
    page_numbers: [1],
  });

  const first = pageImages[0];
  if (!first) return null;

  const pageBuffer = Buffer.isBuffer(first)
    ? first
    : typeof first === "string"
      ? Buffer.from(first, "base64")
      : Buffer.from(first);

  return { base64: pageBuffer.toString("base64"), mimeType: "image/png" };
}

/**
 * Turns an accepted upload into model-ready content. Scope is deliberately
 * narrow: JPEG, PNG, and single-page PDF. Anything else is rejected outright
 * rather than guessed at.
 */
export async function extractDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const mime = normalizeMimeType(mimeType);

  if (!mime) {
    throw new ExtractionError(
      `Unsupported file type for "${fileName}" (${mimeType || "unknown type"}). ` +
        `Accepted types are image/jpeg, image/png and application/pdf.`
    );
  }

  if (mime === "image/jpeg" || mime === "image/png") {
    return {
      sourceFormat: mime,
      text: "",
      images: [{ base64: buffer.toString("base64"), mimeType: mime }],
    };
  }

  // application/pdf - text layer first, rasterized page 1 as the fallback.
  const { text, pageCount } = await extractFirstPageText(buffer);
  const ignoredPages = Math.max(pageCount - AI_CONFIG.documentProcessing.maxPdfPages, 0);
  const pageNote = ignoredPages > 0 ? `, ${ignoredPages} later page(s) ignored` : "";

  if (text.length >= AI_CONFIG.documentProcessing.minExtractedTextChars) {
    return {
      sourceFormat: `application/pdf (page 1 of ${pageCount}${pageNote})`,
      text,
      images: [],
    };
  }

  const image = await rasterizeFirstPage(buffer);
  if (!image) {
    throw new ExtractionError("No readable content could be extracted from page 1 of this PDF.");
  }

  return {
    sourceFormat: `application/pdf (page 1 of ${pageCount}, rasterized${pageNote})`,
    text: "",
    images: [image],
  };
}

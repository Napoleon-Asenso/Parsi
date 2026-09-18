import { inflateRawSync } from "zlib";
import pdfImgConvert from "pdf-img-convert";
import { AI_CONFIG } from "@/config/ai.config";

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

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const TEXT_EXTENSIONS = new Set([
  "txt", "text", "md", "markdown", "mdx", "rst", "csv", "tsv", "json", "jsonl", "ndjson",
  "xml", "html", "htm", "xhtml", "yaml", "yml", "toml", "ini", "cfg", "conf", "env", "log",
  "sql", "rtf", "tex", "srt", "vtt", "eml", "ics", "vcf",
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt", "swift",
  "c", "h", "cpp", "hpp", "cs", "php", "sh", "ps1", "bat", "cmd", "pl", "lua", "r", "scala",
]);

const OOXML_PART_PATTERNS: RegExp[] = [
  /^word\/document\d*\.xml$/,
  /^word\/header\d*\.xml$/,
  /^word\/footer\d*\.xml$/,
  /^word\/footnotes\.xml$/,
  /^word\/endnotes\.xml$/,
  /^xl\/sharedStrings\.xml$/,
  /^xl\/worksheets\/sheet\d*\.xml$/,
  /^ppt\/slides\/slide\d*\.xml$/,
  /^ppt\/notesSlides\/notesSlide\d*\.xml$/,
  /^content\.xml$/,
];

const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIR = 0x06054b50;

function getExtension(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName ?? "");
  return match ? match[1].toLowerCase() : "";
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function looksLikeText(value: string): boolean {
  const sample = value.slice(0, 8000);
  if (sample.trim().length === 0) return false;

  let suspicious = 0;
  for (const char of sample) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || code === 13) continue;
    if (code === 0xfffd || code < 32 || code === 0x7f) suspicious += 1;
  }

  return suspicious / sample.length < 0.05;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function xmlToText(value: string): string {
  return value
    .replace(/<w:p\b[^>]*\/>/g, "\n")
    .replace(/<\/(w:p|a:p|text:p|text:h|w:tr)>/g, "\n")
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scrapePrintableText(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const runs = latin.match(/[\x20-\x7E\t]{4,}/g) ?? [];
  return runs
    .map((run) => run.trim())
    .filter((run) => /[A-Za-z]{2,}/.test(run))
    .join("\n")
    .trim();
}

function isZip(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.readUInt32LE(0) === ZIP_LOCAL_HEADER;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const earliest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIR) return offset;
  }
  return -1;
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const endOfCentralDirectory = findEndOfCentralDirectory(buffer);
  if (endOfCentralDirectory < 0) return entries;

  const entryCount = buffer.readUInt16LE(endOfCentralDirectory + 10);
  let offset = buffer.readUInt32LE(endOfCentralDirectory + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== ZIP_CENTRAL_HEADER) break;

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    // Some zip writers (notably .NET on Windows) use backslash separators.
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength).replace(/\\/g, "/");

    if (
      localHeaderOffset + 30 <= buffer.length &&
      buffer.readUInt32LE(localHeaderOffset) === ZIP_LOCAL_HEADER
    ) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, Math.min(dataStart + compressedSize, buffer.length));

      try {
        entries.set(name, compressionMethod === 0 ? Buffer.from(data) : inflateRawSync(data));
      } catch {
        // Skip entries that cannot be decompressed.
      }
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";

  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (line) pages.push(`--- Page ${pageNumber} ---\n${line}`);
      page.cleanup();
    }
    return { text: pages.join("\n\n").trim(), pageCount: document.numPages };
  } finally {
    await document.destroy();
  }
}

async function rasterizePdf(buffer: Buffer): Promise<ExtractedImage[]> {
  const limit = AI_CONFIG.documentProcessing.maxRasterizedPages;
  const pageImages = await pdfImgConvert.convert(buffer, { scale: 1.5 });

  return pageImages.slice(0, limit).map((page) => {
    const pageBuffer = Buffer.isBuffer(page)
      ? page
      : typeof page === "string"
        ? Buffer.from(page, "base64")
        : Buffer.from(page);
    return { base64: pageBuffer.toString("base64"), mimeType: "image/png" };
  });
}

export async function extractDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const extension = getExtension(fileName);
  const mime = (mimeType ?? "").toLowerCase();

  if (mime.startsWith("image/") || extension in IMAGE_MIME_BY_EXT) {
    const resolvedMime = IMAGE_MIME_BY_EXT[extension] ?? mime;
    return {
      sourceFormat: resolvedMime,
      text: "",
      images: [{ base64: buffer.toString("base64"), mimeType: resolvedMime }],
    };
  }

  if (mime === "application/pdf" || extension === "pdf") {
    const { text, pageCount } = await extractPdfText(buffer);
    if (text.length >= AI_CONFIG.documentProcessing.minExtractedTextChars) {
      return { sourceFormat: `application/pdf (${pageCount} pages)`, text, images: [] };
    }

    const images = await rasterizePdf(buffer);
    if (images.length === 0) {
      throw new ExtractionError("No readable content could be extracted from this PDF.");
    }
    return { sourceFormat: `application/pdf (${pageCount} pages, rasterized)`, text: "", images };
  }

  if (isZip(buffer)) {
    const entries = readZipEntries(buffer);
    const parts: string[] = [];
    for (const [name, data] of entries) {
      if (OOXML_PART_PATTERNS.some((pattern) => pattern.test(name))) {
        const partText = xmlToText(data.toString("utf8"));
        if (partText) parts.push(partText);
      }
    }

    const officeText = parts.join("\n\n").trim();
    if (officeText) {
      return { sourceFormat: mime || extension || "office-document", text: officeText, images: [] };
    }
  }

  const decoded = stripBom(buffer.toString("utf8"));
  if (looksLikeText(decoded)) {
    const isMarkup = extension === "html" || extension === "htm" || extension === "xhtml";
    return {
      sourceFormat: mime || extension || "text",
      text: isMarkup ? stripHtml(decoded) : decoded,
      images: [],
    };
  }

  const scraped = scrapePrintableText(buffer);
  if (scraped.length >= AI_CONFIG.documentProcessing.minExtractedTextChars) {
    return { sourceFormat: `${mime || extension || "binary"} (raw text scrape)`, text: scraped, images: [] };
  }

  throw new ExtractionError(
    `Could not extract any readable content from "${fileName}" (${mimeType || "unknown type"}).`
  );
}

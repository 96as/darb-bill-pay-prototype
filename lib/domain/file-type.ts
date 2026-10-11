// Uploads are untrusted (PL-03, BP-01): only PDF, JPEG, PNG or XML are accepted, decided by content, not by name.
import type { StoredFile } from "./types";

export type AcceptedFileType = "pdf" | "jpeg" | "png" | "xml";

const startsWith = (bytes: Uint8Array, sig: readonly number[], offset = 0) =>
  bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const UTF8_BOM = [0xef, 0xbb, 0xbf];

/**
 * Detects the type from magic bytes. Returns null for anything else.
 * XML: "<?xml" prolog, or a "<" root element when the name ends in .xml. HTML/SVG roots are refused,
 * because a browser would run their scripts.
 */
export function sniffFileType(bytes: Uint8Array, filename: string = ""): AcceptedFileType | null {
  if (startsWith(bytes, PDF)) return "pdf";
  if (startsWith(bytes, JPEG)) return "jpeg";
  if (startsWith(bytes, PNG)) return "png";
  return looksLikeXml(bytes, filename) ? "xml" : null;
}

function looksLikeXml(bytes: Uint8Array, filename: string): boolean {
  const start = startsWith(bytes, UTF8_BOM) ? 3 : 0;
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(start, start + 512)).trimStart();
  if (/^<(?:!doctype\s+html|html[\s>]|svg[\s>:]|\?xml-stylesheet)/i.test(head)) return false;
  if (/^<\?xml[\s?]/.test(head)) return !/<(?:html|svg)[\s>]/i.test(rootElementGuess(head));
  return /\.xml$/i.test(filename) && /^<[A-Za-z_]/.test(head);
}

/** First element tag after the prolog and comments (good enough to refuse an XHTML/SVG document). */
function rootElementGuess(head: string): string {
  const m = /<(?![?!])[^>]*>/.exec(head);
  return m ? m[0] : "";
}

const MIME: Record<AcceptedFileType, StoredFile["mime"]> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
  xml: "application/xml",
};

export function mimeFor(type: AcceptedFileType): StoredFile["mime"] {
  return MIME[type];
}

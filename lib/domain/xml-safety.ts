// Uploaded files are untrusted (PL-03). XML gets a hard gate before any parser sees it.

/** Largest XML we read: 2 MB (a ZATCA invoice is a few tens of KB). */
export const MAX_XML_BYTES = 2 * 1024 * 1024;

export type UnsafeXmlReason = "empty" | "too_large" | "doctype" | "entity" | "markup_declaration";

export class UnsafeXmlError extends Error {
  constructor(
    readonly reason: UnsafeXmlReason,
    message: string,
  ) {
    super(message);
    this.name = "UnsafeXmlError";
  }
}

/**
 * Throws UnsafeXmlError unless the text is a plain XML document: no DOCTYPE, no ENTITY or other
 * markup declarations (blocks XXE and billion-laughs), at most MAX_XML_BYTES.
 * Comments (<!-- -->) and CDATA sections are allowed.
 */
export function assertSafeXml(text: string): void {
  if (text.length > MAX_XML_BYTES || utf8Length(text) > MAX_XML_BYTES) {
    throw new UnsafeXmlError("too_large", `XML is larger than ${MAX_XML_BYTES} bytes`);
  }
  if (text.trim() === "") throw new UnsafeXmlError("empty", "XML is empty");
  if (/<!DOCTYPE/i.test(text)) throw new UnsafeXmlError("doctype", "XML with a DOCTYPE is not accepted");
  if (/<!ENTITY/i.test(text)) throw new UnsafeXmlError("entity", "XML with entity declarations is not accepted");
  // Any other "<!" that is not a comment or CDATA (ELEMENT, ATTLIST, NOTATION, conditional sections).
  if (/<!(?!--|\[CDATA\[)/.test(text)) {
    throw new UnsafeXmlError("markup_declaration", "XML with markup declarations is not accepted");
  }
}

function utf8Length(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++; // surrogate pair
    } else bytes += 3;
  }
  return bytes;
}

/** Decodes XML bytes to text: UTF-8 (BOM stripped) or UTF-16 with a BOM. Invalid sequences become U+FFFD. */
export function decodeXmlBytes(bytes: Uint8Array): string {
  if (bytes.length > MAX_XML_BYTES) throw new UnsafeXmlError("too_large", `XML is larger than ${MAX_XML_BYTES} bytes`);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  return new TextDecoder("utf-8").decode(bytes.subarray(start));
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * Decodes the five predefined XML entities and numeric character references only.
 * The parser runs with entity processing off, so text arrives raw ("Co. &amp; Sons").
 */
export function decodeXmlText(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] !== "#") return NAMED_ENTITIES[ref] ?? whole;
    const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
  });
}

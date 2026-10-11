// Finds the ZATCA XML inside a PDF/A-3 (PL-03, BP-03): Names → EmbeddedFiles name tree, then /AF arrays.
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  decodePDFRawStream,
  type PDFContext,
  type PDFObject,
} from "pdf-lib";
import { MAX_XML_BYTES, UnsafeXmlError, decodeXmlBytes } from "./xml-safety";

const MAX_TREE_DEPTH = 32;

interface FileSpec {
  spec: PDFDict;
  /** Name tree key, used when the spec has no F/UF. */
  key?: string;
}

/**
 * Returns the first embedded *.xml file (or one with an XML MIME subtype), or null if there is none.
 * Throws if the bytes are not a loadable PDF, or if the embedded XML inflates past MAX_XML_BYTES.
 * Encrypted PDFs return null (their attachments cannot be read).
 */
export async function extractEmbeddedXml(bytes: Uint8Array): Promise<{ filename: string; xml: string } | null> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
  if (doc.isEncrypted) return null;
  const ctx = doc.context;

  for (const { spec, key } of fileSpecs(doc)) {
    const filename = baseName(specName(spec, ctx) ?? key ?? "");
    const stream = embeddedStream(spec, ctx);
    if (!stream || !(isXmlName(filename) || isXmlSubtype(stream, ctx))) continue;
    const data = await streamBytes(stream, ctx);
    if (!data) continue;
    return { filename: filename || "embedded.xml", xml: decodeXmlBytes(data) };
  }
  return null;
}

/** Name tree specs first (the usual place), then catalog and page /AF entries; each spec once. */
function fileSpecs(doc: PDFDocument): FileSpec[] {
  const ctx = doc.context;
  const out: FileSpec[] = [];
  const seen = new Set<PDFDict>();
  const add = (spec: PDFObject | undefined, key?: string) => {
    if (spec instanceof PDFDict && !seen.has(spec)) {
      seen.add(spec);
      out.push({ spec, key });
    }
  };

  const names = lookup(ctx, doc.catalog.get(PDFName.of("Names")));
  const tree = names instanceof PDFDict ? lookup(ctx, names.get(PDFName.of("EmbeddedFiles"))) : undefined;
  if (tree instanceof PDFDict) walkNameTree(tree, ctx, add, new Set(), 0);

  const afHolders: PDFDict[] = [doc.catalog];
  try {
    afHolders.push(...doc.getPages().map((p) => p.node));
  } catch {
    // A broken page tree does not stop us reading the catalog's /AF.
  }
  for (const holder of afHolders) {
    const af = lookup(ctx, holder.get(PDFName.of("AF")));
    if (af instanceof PDFArray) for (let i = 0; i < af.size(); i++) add(lookup(ctx, af.get(i)));
  }
  return out;
}

function walkNameTree(
  node: PDFDict,
  ctx: PDFContext,
  add: (spec: PDFObject | undefined, key?: string) => void,
  visited: Set<PDFDict>,
  depth: number,
): void {
  if (depth > MAX_TREE_DEPTH || visited.has(node)) return;
  visited.add(node);
  const pairs = lookup(ctx, node.get(PDFName.of("Names")));
  if (pairs instanceof PDFArray) {
    for (let i = 0; i + 1 < pairs.size(); i += 2) add(lookup(ctx, pairs.get(i + 1)), textValue(lookup(ctx, pairs.get(i))));
  }
  const kids = lookup(ctx, node.get(PDFName.of("Kids")));
  if (kids instanceof PDFArray) {
    for (let i = 0; i < kids.size(); i++) {
      const kid = lookup(ctx, kids.get(i));
      if (kid instanceof PDFDict) walkNameTree(kid, ctx, add, visited, depth + 1);
    }
  }
}

function lookup(ctx: PDFContext, obj: PDFObject | undefined): PDFObject | undefined {
  try {
    return ctx.lookup(obj);
  } catch {
    return undefined;
  }
}

function textValue(obj: PDFObject | undefined): string | undefined {
  return obj instanceof PDFString || obj instanceof PDFHexString ? obj.decodeText() : undefined;
}

function specName(spec: PDFDict, ctx: PDFContext): string | undefined {
  return textValue(lookup(ctx, spec.get(PDFName.of("UF")))) ?? textValue(lookup(ctx, spec.get(PDFName.of("F"))));
}

function embeddedStream(spec: PDFDict, ctx: PDFContext): PDFRawStream | undefined {
  const ef = lookup(ctx, spec.get(PDFName.of("EF")));
  if (!(ef instanceof PDFDict)) return undefined;
  for (const key of ["UF", "F"]) {
    const stream = lookup(ctx, ef.get(PDFName.of(key)));
    if (stream instanceof PDFRawStream) return stream;
  }
  return undefined;
}

/** Untrusted names may carry paths; keep only the last segment. */
const baseName = (name: string) => name.split(/[\\/]/).pop() ?? "";
const isXmlName = (name: string) => /\.xml$/i.test(name);

function isXmlSubtype(stream: PDFRawStream, ctx: PDFContext): boolean {
  const subtype = lookup(ctx, stream.dict.get(PDFName.of("Subtype")));
  return subtype instanceof PDFName && /(?:^|\/)xml$|\+xml$/i.test(subtype.decodeText());
}

/** Stream contents, inflated with a hard size cap (a decompression bomb stops at MAX_XML_BYTES). Null if undecodable. */
async function streamBytes(stream: PDFRawStream, ctx: PDFContext): Promise<Uint8Array | null> {
  const filter = lookup(ctx, stream.dict.get(PDFName.of("Filter")));
  const filters = filter instanceof PDFArray ? filter.asArray().map((f) => lookup(ctx, f)) : filter ? [filter] : [];
  const names = filters.map((f) => (f instanceof PDFName ? f.decodeText() : "?"));
  const hasParams = stream.dict.has(PDFName.of("DecodeParms"));

  let data: Uint8Array | null;
  if (names.length === 0) data = stream.contents;
  else if (names.length === 1 && names[0] === "FlateDecode" && !hasParams) data = await inflateCapped(stream.contents);
  else {
    try {
      data = decodePDFRawStream(stream).decode();
    } catch {
      return null;
    }
  }
  if (data && data.length > MAX_XML_BYTES) throw new UnsafeXmlError("too_large", `Embedded XML is larger than ${MAX_XML_BYTES} bytes`);
  return data;
}

async function inflateCapped(compressed: Uint8Array): Promise<Uint8Array | null> {
  const reader = new Blob([compressed.slice()]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_XML_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new UnsafeXmlError("too_large", `Embedded XML is larger than ${MAX_XML_BYTES} bytes`);
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof UnsafeXmlError) throw err;
    return null; // corrupt deflate data
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

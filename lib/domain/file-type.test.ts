import { describe, expect, it } from "vitest";
import { mimeFor, sniffFileType } from "./file-type";

const bytes = (...xs: number[]) => new Uint8Array(xs);
const text = (s: string) => new TextEncoder().encode(s);

describe("sniffFileType", () => {
  it("detects PDF, JPEG and PNG by magic bytes, whatever the name says", () => {
    expect(sniffFileType(text("%PDF-1.7\n..."), "invoice.pdf")).toBe("pdf");
    expect(sniffFileType(text("%PDF-1.4\n..."), "renamed.jpg")).toBe("pdf");
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10), "photo.jpg")).toBe("jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00), "scan.png")).toBe("png");
  });

  it("detects XML with a prolog regardless of name", () => {
    expect(sniffFileType(text('<?xml version="1.0" encoding="UTF-8"?>\n<Invoice/>'), "upload.bin")).toBe("xml");
    expect(sniffFileType(new Uint8Array([0xef, 0xbb, 0xbf, ...text("<?xml version='1.0'?><Invoice/>")]), "x")).toBe("xml");
    expect(sniffFileType(text("\n  <?xml version='1.0'?><Invoice/>"), "x")).toBe("xml");
  });

  it("accepts XML without a prolog only when the name ends in .xml", () => {
    expect(sniffFileType(text("<Invoice xmlns='urn:x'/>"), "INV-1.xml")).toBe("xml");
    expect(sniffFileType(text("<Invoice xmlns='urn:x'/>"), "INV-1.txt")).toBeNull();
  });

  it("refuses HTML and SVG even when named .xml", () => {
    expect(sniffFileType(text("<!DOCTYPE html><html><script>x</script></html>"), "a.xml")).toBeNull();
    expect(sniffFileType(text("<html><body/></html>"), "a.xml")).toBeNull();
    expect(sniffFileType(text('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"/>'), "a.xml")).toBeNull();
    expect(sniffFileType(text('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'), "a.xml")).toBeNull();
    expect(sniffFileType(text('<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"/>'), "a.xml")).toBeNull();
  });

  it("refuses everything else", () => {
    expect(sniffFileType(text("MZ\x90\x00"), "invoice.pdf")).toBeNull(); // Windows executable
    expect(sniffFileType(bytes(0x50, 0x4b, 0x03, 0x04), "invoice.xml")).toBeNull(); // zip/docx
    expect(sniffFileType(text("GIF89a"), "x.gif")).toBeNull();
    expect(sniffFileType(text("plain text"), "x.xml")).toBeNull();
    expect(sniffFileType(new Uint8Array(0), "x.pdf")).toBeNull();
    expect(sniffFileType(bytes(0xff, 0xd8), "x.jpg")).toBeNull(); // truncated magic
  });
});

describe("mimeFor", () => {
  it("maps to StoredFile mime types", () => {
    expect(mimeFor("pdf")).toBe("application/pdf");
    expect(mimeFor("jpeg")).toBe("image/jpeg");
    expect(mimeFor("png")).toBe("image/png");
    expect(mimeFor("xml")).toBe("application/xml");
  });
});

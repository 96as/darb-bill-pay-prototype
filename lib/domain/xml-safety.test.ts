import { describe, expect, it } from "vitest";
import { MAX_XML_BYTES, UnsafeXmlError, assertSafeXml, decodeXmlBytes, decodeXmlText } from "./xml-safety";
import { BILLION_LAUGHS_XML, PARAMETER_ENTITY_XML, XXE_XML } from "./__fixtures__/hostile-xml";

function reasonOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof UnsafeXmlError ? e.reason : `other: ${String(e)}`;
  }
  return undefined;
}

describe("assertSafeXml", () => {
  it("accepts plain XML with comments and CDATA", () => {
    expect(() => assertSafeXml('<?xml version="1.0"?><!-- hi --><a><![CDATA[x < y]]></a>')).not.toThrow();
  });

  it("refuses XXE", () => {
    expect(reasonOf(() => assertSafeXml(XXE_XML))).toBe("doctype");
  });

  it("refuses billion laughs", () => {
    expect(reasonOf(() => assertSafeXml(BILLION_LAUGHS_XML))).toBe("doctype");
  });

  it("refuses parameter entities", () => {
    expect(reasonOf(() => assertSafeXml(PARAMETER_ENTITY_XML))).toBe("doctype");
  });

  it("refuses a bare ENTITY or other markup declarations, in any case", () => {
    expect(reasonOf(() => assertSafeXml('<a><!entity x "y"></a>'))).toBe("entity");
    expect(reasonOf(() => assertSafeXml("<a><!ELEMENT a ANY></a>"))).toBe("markup_declaration");
    expect(reasonOf(() => assertSafeXml("<!doctype a><a/>"))).toBe("doctype");
  });

  it("refuses oversize and empty input", () => {
    const big = `<a>${"x".repeat(MAX_XML_BYTES)}</a>`;
    expect(reasonOf(() => assertSafeXml(big))).toBe("too_large");
    // Under the limit in characters but over it in UTF-8 bytes (Arabic letters are 2 bytes).
    const arabic = `<a>${"ب".repeat(MAX_XML_BYTES / 2 + 10)}</a>`;
    expect(arabic.length).toBeLessThan(MAX_XML_BYTES);
    expect(reasonOf(() => assertSafeXml(arabic))).toBe("too_large");
    expect(reasonOf(() => assertSafeXml("   "))).toBe("empty");
  });
});

describe("decodeXmlBytes", () => {
  const enc = new TextEncoder();

  it("strips a UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode("<a>شركة</a>")]);
    expect(decodeXmlBytes(bytes)).toBe("<a>شركة</a>");
  });

  it("decodes UTF-16 LE with a BOM", () => {
    const text = "<a>ok</a>";
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes.set([0xff, 0xfe]);
    for (let i = 0; i < text.length; i++) bytes[2 + i * 2] = text.charCodeAt(i);
    expect(decodeXmlBytes(bytes)).toBe(text);
  });

  it("refuses oversize bytes", () => {
    expect(() => decodeXmlBytes(new Uint8Array(MAX_XML_BYTES + 1))).toThrow(UnsafeXmlError);
  });
});

describe("decodeXmlText", () => {
  it("decodes only predefined and numeric entities", () => {
    expect(decodeXmlText("Co. &amp; Sons &lt;3&gt; &quot;x&quot; &apos;y&apos;")).toBe(`Co. & Sons <3> "x" 'y'`);
    expect(decodeXmlText("&#1588;&#x0631;")).toBe("شر");
    expect(decodeXmlText("&xxe; &#0; &#xD800;")).toBe("&xxe; &#0; &#xD800;");
    expect(decodeXmlText("plain")).toBe("plain");
  });
});

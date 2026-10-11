// Uploaded files are untrusted (PL-03): every file-serving route answers with sandboxing headers, and XML is
// never rendered. Runs the real route handlers against an isolated store (DARB_DATA_DIR in a temp dir).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IngestResult } from "@/lib/server/services";
import * as demoReset from "@/app/api/demo/reset/route";
import * as bills from "@/app/api/bills/route";
import * as files from "@/app/api/files/[id]/route";
import * as attachments from "@/app/api/inbox/[emailId]/attachments/[index]/route";
import * as confirmation from "@/app/api/payments/[billId]/confirmation/route";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const get = (handler: unknown, url: string, params: Record<string, string>) =>
  (handler as Handler)(new Request(`http://localhost${url}`), { params: Promise.resolve(params) });

const STORED_CSP = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
const GENERATED_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

async function upload(bytes: Uint8Array, name: string, type: string): Promise<string> {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type }));
  const res = await (bills.POST as unknown as Handler)(new Request("http://localhost/api/bills", { method: "POST", body: form }), { params: Promise.resolve({}) });
  expect(res.status).toBe(201);
  return ((await res.json()) as IngestResult).bill.file!.id;
}

function expectStoredFileHeaders(res: Response, mime: string, disposition: "inline" | "attachment") {
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe(mime);
  expect(res.headers.get("content-security-policy")).toBe(STORED_CSP);
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(res.headers.get("content-disposition")?.startsWith(`${disposition};`)).toBe(true);
}

let dataDir: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "darb-files-"));
  process.env.DARB_DATA_DIR = dataDir;
  await (demoReset.POST as unknown as () => Promise<Response>)();
  ids.pdf = await upload(readFileSync("fixtures/invoices/INV-2026-0451-cool-breeze.pdf"), "INV-2026-0451.pdf", "application/pdf");
  ids.xml = await upload(readFileSync("fixtures/invoices/variants/english.xml"), "invoice.xml", "application/xml");
  ids.png = await upload(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), "scan.png", "image/png");
});

afterAll(() => {
  delete process.env.DARB_DATA_DIR;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("GET /api/files/{id} (PL-03: files are untrusted)", () => {
  it("serves an uploaded PDF inline, sandboxed", async () => {
    expectStoredFileHeaders(await get(files.GET, `/api/files/${ids.pdf}`, { id: ids.pdf }), "application/pdf", "inline");
  });

  it("serves an uploaded image inline, sandboxed", async () => {
    expectStoredFileHeaders(await get(files.GET, `/api/files/${ids.png}`, { id: ids.png }), "image/png", "inline");
  });

  it("serves uploaded XML only as a download, sandboxed", async () => {
    expectStoredFileHeaders(await get(files.GET, `/api/files/${ids.xml}`, { id: ids.xml }), "application/xml", "attachment");
  });

  it("serves the seeded fixture PDF the same way", async () => {
    expectStoredFileHeaders(await get(files.GET, "/api/files/f_seed_gol_0917", { id: "f_seed_gol_0917" }), "application/pdf", "inline");
  });

  it("serves nothing that is not in the store", async () => {
    const res = await get(files.GET, "/api/files/..%2F..%2Fpackage.json", { id: "../../package.json" });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

describe("GET /api/inbox/{emailId}/attachments/{index}", () => {
  it("serves email attachments with the same sandboxing headers", async () => {
    expectStoredFileHeaders(await get(attachments.GET, "/api/inbox/e_october/attachments/0", { emailId: "e_october", index: "0" }), "application/pdf", "inline");
    expectStoredFileHeaders(await get(attachments.GET, "/api/inbox/e_october/attachments/1", { emailId: "e_october", index: "1" }), "image/jpeg", "inline");
    expect((await get(attachments.GET, "/api/inbox/e_october/attachments/9", { emailId: "e_october", index: "9" })).status).toBe(404);
  });
});

describe("GET /api/payments/{billId}/confirmation (our own HTML)", () => {
  it("downloads by default, with a strict CSP and no sandbox needed", async () => {
    const res = await get(confirmation.GET, "/api/payments/b_gol_0822/confirmation", { billId: "b_gol_0822" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-security-policy")).toBe(GENERATED_CSP);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(res.headers.get("content-disposition")?.startsWith("attachment;")).toBe(true);
    expect(await res.text()).not.toMatch(/<script/i);
  });

  it("opens inline on request, with the same CSP", async () => {
    const res = await get(confirmation.GET, "/api/payments/b_gol_0822/confirmation?disposition=inline", { billId: "b_gol_0822" });
    expect(res.headers.get("content-disposition")?.startsWith("inline;")).toBe(true);
    expect(res.headers.get("content-security-policy")).toBe(GENERATED_CSP);
  });
});

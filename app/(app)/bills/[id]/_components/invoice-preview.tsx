"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileCode, FileQuestion, FileX, Minus, Plus, ScanSearch } from "lucide-react";
import { EmptyState } from "@/components/darb/empty-state";
import { Panel } from "@/components/darb/panel";
import { PdfPages } from "@/components/darb/pdf-page";
import { fileIconFor } from "@/components/darb/upload-invoice";
import { Button } from "@/components/ui/button";
import type { StoredFile } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/client";
import { formatFileSize } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

type Load = { state: "loading" } | { state: "ok"; text?: string } | { state: "missing" };

/** GET /api/files/{id} (served inline). XML is fetched as text; PDF and images only probed. */
function useFile(file: StoredFile | undefined): Load {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const url = `/api/files/${file.id}`;
    const isXml = file.mime === "application/xml";
    fetch(url, { method: isXml ? "GET" : "HEAD", cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return setLoad({ state: "missing" });
        setLoad(isXml ? { state: "ok", text: await res.text() } : { state: "ok" });
      })
      .catch(() => !cancelled && setLoad({ state: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [file]);
  return file ? load : { state: "missing" };
}

/** Re-indents XML for reading. Text is rendered by React, so nothing in the file is executed. */
function prettyXml(xml: string): string {
  const tokens = xml.replace(/>\s+</g, "><").replace(/(>)(<)(\/*)/g, "$1\n$2$3").split("\n");
  let depth = 0;
  return tokens
    .map((line) => {
      const trimmed = line.trim();
      if (/^<\/\w/.test(trimmed)) depth = Math.max(depth - 1, 0);
      const out = `${"  ".repeat(depth)}${trimmed}`;
      if (/^<\w[^>]*[^/]>.*$/.test(trimmed) && !/<\/\w[^>]*>$/.test(trimmed) && !trimmed.startsWith("<?")) depth += 1;
      return out;
    })
    .join("\n");
}

function XmlView({ text }: { text: string }) {
  const lines = prettyXml(text).split("\n");
  return (
    <pre dir="ltr" className="max-h-[720px] overflow-auto bg-background-secondary p-4 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => {
        const m = /^(\s*)(<\/?[\w:.-]+)(.*?)(\/?>)(.*)$/.exec(line);
        return (
          <div key={i} className="whitespace-pre">
            {m ? (
              <>
                {m[1]}
                <span className="text-primary">{m[2]}</span>
                <span className="text-muted-foreground">{m[3]}</span>
                <span className="text-primary">{m[4]}</span>
                <span className="text-foreground">{m[5]}</span>
              </>
            ) : (
              line
            )}
          </div>
        );
      })}
    </pre>
  );
}

function ImageView({ src, alt }: { src: string; alt: string }) {
  const t = useT();
  const [zoom, setZoom] = useState(1);
  return (
    <div className="relative">
      <div className="absolute end-3 top-3 z-10 flex items-center gap-1 rounded-lg border bg-background/95 p-0.5 shadow-sm">
        <Button variant="ghost" size="icon-sm" aria-label={t.billDetail.preview.zoomOut} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}>
          <Minus aria-hidden />
        </Button>
        <button type="button" onClick={() => setZoom(1)} className="min-w-12 rounded-md px-1.5 text-xs tabular-nums hover:bg-muted" aria-label={t.billDetail.preview.resetZoom}>
          {Math.round(zoom * 100)}%
        </button>
        <Button variant="ghost" size="icon-sm" aria-label={t.billDetail.preview.zoomIn} onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4}>
          <Plus aria-hidden />
        </Button>
      </div>
      <div className="max-h-[720px] overflow-auto bg-background-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, size unknown */}
        <img
          src={src}
          alt={alt}
          onClick={() => setZoom((z) => (z >= 4 ? 1 : z + 1))}
          className={cn("mx-auto block max-w-none origin-top cursor-zoom-in", zoom >= 4 && "cursor-zoom-out")}
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Left column of the bill: the invoice itself (PDF in an iframe, image with zoom, XML pretty view). */
export function InvoicePreview({ file, title }: { file?: StoredFile; title: string }) {
  const t = useT();
  const load = useFile(file);
  const url = file ? `/api/files/${file.id}` : undefined;
  const Icon = file ? fileIconFor(file.name) : FileQuestion;

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-surface text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">{t.billDetail.preview.title}</h2>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {file ? `${file.name}${file.size ? ` · ${formatFileSize(file.size)}` : ""}` : "—"}
          </p>
        </div>
        {url && load.state === "ok" ? (
          <a
            href={url}
            {...(file?.mime.startsWith("image/") ? { target: "_blank", rel: "noopener noreferrer" } : { download: file?.name })}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline hover:underline-offset-4">
            {file?.mime.startsWith("image/") ? (
              <>
                {t.billDetail.preview.openFile}
                <ExternalLink className="size-3.5 rtl:-scale-x-100" aria-hidden />
              </>
            ) : (
              <>
                {t.billDetail.preview.download}
                <Download className="size-3.5" aria-hidden />
              </>
            )}
          </a>
        ) : null}
      </div>
      {!file ? (
        <EmptyState icon={FileX} title={t.billDetail.preview.noFile} description={t.billDetail.preview.noFileDescription} className="py-24" />
      ) : load.state === "loading" ? (
        <div className="h-[560px] animate-pulse bg-muted/50" aria-busy />
      ) : load.state === "missing" ? (
        <EmptyState
          icon={ScanSearch}
          title={t.billDetail.preview.notAvailable}
          description={t.billDetail.preview.notAvailableDescription}
          className="py-24"
        />
      ) : file.mime === "application/pdf" ? (
        // Untrusted upload: drawn by pdf.js on canvas (all pages, width-fit), never in an iframe.
        <PdfPages url={url!} name={file.name} className="max-h-[760px] overflow-y-auto bg-background-secondary p-4" />
      ) : file.mime === "application/xml" ? (
        <div>
          <p className="flex items-center gap-1.5 border-b px-5 py-2 text-xs text-muted-foreground">
            <FileCode className="size-3.5" aria-hidden />
            {t.billDetail.preview.xmlTitle}
          </p>
          <XmlView text={load.text ?? ""} />
        </div>
      ) : (
        <ImageView src={url!} alt={title} />
      )}
    </Panel>
  );
}

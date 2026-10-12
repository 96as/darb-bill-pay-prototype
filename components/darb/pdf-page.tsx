"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// pdf.js renders invoice PDFs to <canvas> (iframes show blank in headless Chrome and some embedded
// browsers). It is loaded on first use only (dynamic import), so routes without a PDF don't ship it.

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

/** One loaded document per URL, shared by thumbnails and the viewer. */
const documents = new Map<string, Promise<PDFDocumentProxy>>();

function loadDocument(url: string): Promise<PDFDocumentProxy> {
  let doc = documents.get(url);
  if (!doc) {
    doc = loadPdfJs().then(
      (pdfjs) =>
        pdfjs.getDocument({
          url,
          // Uploaded files are untrusted: never compile font code with eval.
          isEvalSupported: false,
          disableRange: true,
          disableStream: true,
        }).promise,
    );
    doc.catch(() => documents.delete(url)); // a failed load can be retried later
    documents.set(url, doc);
  }
  return doc;
}

type DocState = { status: "loading" } | { status: "ready"; doc: PDFDocumentProxy } | { status: "error" };

function usePdfDocument(url: string): DocState {
  const [state, setState] = useState<{ url: string; value: DocState }>({ url, value: { status: "loading" } });
  useEffect(() => {
    let alive = true;
    loadDocument(url).then(
      (doc) => alive && setState({ url, value: { status: "ready", doc } }),
      () => alive && setState({ url, value: { status: "error" } }),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return state.url === url ? state.value : { status: "loading" };
}

/** Width of an element in CSS pixels, kept up to date. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Draws one page at the given CSS width, at device-pixel ratio. */
function PageCanvas({
  doc,
  page,
  width,
  onRendered,
  onError,
}: {
  doc: PDFDocumentProxy;
  page: number;
  width: number;
  onRendered?: () => void;
  onError?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      try {
        const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const viewport = p.getViewport({ scale: (width / base.width) * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${Math.round((width * base.height) / base.width)}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("no 2d context");
        const render = p.render({ canvasContext: context, viewport });
        task = render;
        await render.promise;
        if (!cancelled) onRendered?.();
      } catch (err) {
        if (!cancelled && (err as { name?: string })?.name !== "RenderingCancelledException") onError?.();
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are notifications only
  }, [doc, page, width]);
  // dir="ltr": a canvas inherits CSS direction, and pdf.js text drawn under rtl comes out garbled.
  return <canvas ref={canvasRef} dir="ltr" className="block bg-white" />;
}

/** File tile + "Open file" link, shown when the PDF can't be drawn. */
export function PdfFallback({ url, name, compact, className }: { url: string; name?: string; compact?: boolean; className?: string }) {
  const t = useT();
  return (
    <div className={cn("flex size-full flex-col items-center justify-center gap-1.5 bg-card p-2 text-center", className)}>
      <FileText className={cn("text-primary", compact ? "size-4" : "size-6")} aria-hidden />
      {!compact && name ? (
        <span dir="ltr" className="line-clamp-2 text-[10px] leading-tight break-all text-foreground">
          {name}
        </span>
      ) : null}
      {!compact ? (
        <a
          href={url}
          download={name ?? true}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t.payments.downloadFile}
          <Download className="size-3" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

/**
 * Page `page` of the PDF at `url`, width-fit to its box. In a fixed-height box (thumbnails) the page
 * is top-aligned and cropped. Skeleton while loading; file tile + "Open file" if it can't be drawn.
 */
export function PdfPage({
  url,
  page = 1,
  name,
  compactFallback,
  className,
}: {
  url: string;
  page?: number;
  /** File name for the fallback tile. */
  name?: string;
  /** Icon-only fallback for very small boxes. */
  compactFallback?: boolean;
  className?: string;
}) {
  const t = useT();
  const state = usePdfDocument(url);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);
  const error = state.status === "error" || failed;

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-white", className)} aria-busy={!drawn && !error}>
      {error ? (
        <PdfFallback url={url} name={name} compact={compactFallback} />
      ) : (
        <>
          {state.status === "ready" ? (
            <PageCanvas doc={state.doc} page={page} width={width} onRendered={() => setDrawn(true)} onError={() => setFailed(true)} />
          ) : null}
          {!drawn ? (
            <span className="absolute inset-0 animate-pulse bg-muted" role="status" aria-label={t.payments.pdfLoading} />
          ) : null}
        </>
      )}
    </div>
  );
}

/** Every page of the PDF, stacked and width-fit (full-screen viewer, bill detail preview). */
export function PdfPages({ url, name, className }: { url: string; name?: string; className?: string }) {
  const t = useT();
  const state = usePdfDocument(url);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [failed, setFailed] = useState(false);

  if (state.status === "error" || failed) {
    return (
      <div className={cn("flex min-h-60 items-center justify-center", className)}>
        <PdfFallback url={url} name={name} className="size-auto rounded-lg border px-6 py-5" />
      </div>
    );
  }
  return (
    <div className={className}>
      <div ref={ref} className="mx-auto flex w-full flex-col gap-3">
        {state.status === "ready" && width > 0 ? (
          Array.from({ length: state.doc.numPages }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-sm shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_1px_rgb(0_0_0/0.04)]">
              <PageCanvas doc={state.doc} page={i + 1} width={width} onError={() => setFailed(true)} />
            </div>
          ))
        ) : (
          <div
            className="aspect-[1/1.414] w-full animate-pulse rounded-sm bg-muted"
            role="status"
            aria-label={t.payments.pdfLoading}
          />
        )}
      </div>
    </div>
  );
}

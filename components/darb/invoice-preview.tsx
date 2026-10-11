"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, ExternalLink, FileCode, FileX, ImageIcon, Landmark, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Bill, StoredFile } from "@/lib/domain/types";
import { fmt } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { PdfPage, PdfPages } from "./pdf-page";
import { usePortalContainer } from "./portal-container";

// Uploaded files are untrusted: they are never shown in an <iframe>. PDFs are drawn with pdf.js on a
// canvas, images with <img>, XML as escaped text in a <pre>.

/** Inline invoice file served by app/api (GET /api/files/{fileId}). */
export const fileUrl = (file: Pick<StoredFile, "id">) => `/api/files/${encodeURIComponent(file.id)}`;

type ThumbSize = "sm" | "md";

const SIZES: Record<ThumbSize, string> = {
  sm: "h-[52px] w-10 rounded-md",
  md: "h-[112px] w-[84px] rounded-lg",
};

const isImage = (file: StoredFile) => file.mime === "image/jpeg" || file.mime === "image/png";
const isPdf = (file: StoredFile) => file.mime === "application/pdf";

/**
 * Invoice thumbnail beside an amount. PDF → page 1 drawn by pdf.js, cropped to the box (+ "e-invoice"
 * chip when read from ZATCA XML); image → the photo; XML → file tile; SADAD → biller tile; no file →
 * muted tile. Tapping opens the file full screen (inside the phone frame on /m).
 */
export function InvoiceThumb({
  bill,
  size = "md",
  className,
}: {
  bill: Pick<Bill, "file" | "extraction" | "kind" | "sadad" | "invoiceNumber">;
  size?: ThumbSize;
  className?: string;
}) {
  const t = useT();
  const file = bill.file;
  const base = cn(
    "relative flex shrink-0 overflow-hidden border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.06)]",
    SIZES[size],
    className,
  );

  if (!file) {
    const sadad = bill.kind === "sadad";
    const Icon = sadad ? Landmark : FileX;
    return (
      <div className={cn(base, "flex-col items-center justify-center gap-1 bg-muted/60 text-muted-foreground shadow-none")}>
        <Icon className={size === "sm" ? "size-4" : "size-5"} aria-hidden />
        {size === "md" ? (
          <span className="px-1 text-center text-[10px] leading-tight">
            {sadad ? fmt(t.payments.biller, { code: bill.sadad?.billerCode ?? "" }) : t.payments.noFile}
          </span>
        ) : (
          <span className="sr-only">{sadad ? t.payments.rails.sadad : t.payments.noFile}</span>
        )}
      </div>
    );
  }

  return (
    <InvoiceViewer file={file}>
      <ThumbFace file={file} size={size} eInvoice={bill.extraction === "e_invoice"} className={base} />
    </InvoiceViewer>
  );
}

function ThumbFace({
  file,
  size,
  eInvoice,
  className,
}: {
  file: StoredFile;
  size: ThumbSize;
  eInvoice: boolean;
  className: string;
}) {
  const t = useT();
  const [broken, setBroken] = useState(false);

  if (isPdf(file)) {
    return (
      <span className={className}>
        <PdfPage url={fileUrl(file)} name={file.name} compactFallback className="size-full" />
        {eInvoice && size === "md" ? (
          <span className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-white via-white/90 to-transparent pt-3 pb-1">
            <span className="inline-flex h-4 items-center rounded-full bg-information px-1.5 text-[9px] font-medium text-information-foreground">
              {t.payments.eInvoice}
            </span>
          </span>
        ) : null}
      </span>
    );
  }

  if (isImage(file) && !broken) {
    return (
      <span className={cn(className, "bg-muted")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served by app/api, not a static asset */}
        <img
          src={fileUrl(file)}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-full object-cover object-top"
        />
      </span>
    );
  }

  const Icon = isImage(file) ? ImageIcon : FileCode;
  return (
    <span className={cn(className, "flex-col items-center justify-center gap-1 p-1.5 text-center text-primary")}>
      <Icon className={size === "sm" ? "size-4" : "size-5"} aria-hidden />
      {size === "md" ? (
        <span dir="ltr" className="line-clamp-3 text-[10px] leading-tight break-all text-foreground">
          {file.name}
        </span>
      ) : null}
    </span>
  );
}

/** XML shown as text (React escapes it; nothing in the file is ever interpreted). */
function XmlText({ url }: { url: string }) {
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((body) => alive && setText(body))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [url]);
  if (failed) return <p className="p-6 text-sm text-muted-foreground">{t.payments.errors.generic}</p>;
  if (text === null) return <p className="p-6 text-sm text-muted-foreground">{t.payments.xmlLoading}</p>;
  return (
    <pre dir="ltr" className="size-full overflow-auto bg-background p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
      {text}
    </pre>
  );
}

/** Full-screen file viewer: PDF pages drawn by pdf.js, image in an <img>, XML as text. No iframes. */
export function InvoiceViewer({ file, children }: { file: StoredFile; children: React.ReactNode }) {
  const t = useT();
  const container = usePortalContainer();
  const inFrame = Boolean(container);
  const url = fileUrl(file);

  return (
    <Dialog.Root>
      <Dialog.Trigger
        render={
          <button
            type="button"
            aria-label={fmt(t.payments.openInvoice, { name: file.name })}
            className="shrink-0 cursor-zoom-in rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        {children}
      </Dialog.Trigger>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-background shadow-lg outline-none transition duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
            inFrame ? "inset-0" : "inset-4 rounded-xl border md:inset-x-[10%] md:inset-y-8",
          )}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-medium" dir="ltr">
              {file.name}
            </Dialog.Title>
            {!file.mime.startsWith("image/") ? (
              <a
                href={url}
                download={file.name}
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                aria-label={t.payments.downloadFile}
                title={t.payments.downloadFile}
              >
                <Download aria-hidden />
              </a>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                aria-label={t.payments.openInNewTab}
                title={t.payments.openInNewTab}
              >
                <ExternalLink aria-hidden />
              </a>
            )}
            <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={t.payments.close}>
              <XIcon aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60">
            {isPdf(file) ? (
              <PdfPages url={url} name={file.name} className="mx-auto w-full max-w-3xl p-3" />
            ) : isImage(file) ? (
              <div className="flex min-h-full items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by app/api, not a static asset */}
                <img src={url} alt={file.name} className="max-w-full object-contain" />
              </div>
            ) : (
              <XmlText url={url} />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

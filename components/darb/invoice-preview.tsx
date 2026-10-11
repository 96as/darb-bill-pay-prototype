"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ExternalLink, FileCode, FileText, FileX, ImageIcon, Landmark, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Bill, StoredFile } from "@/lib/domain/types";
import { fmt } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { usePortalContainer } from "./portal-container";

/** Inline invoice file served by app/api (GET /api/files/{fileId}). */
export const fileUrl = (file: Pick<StoredFile, "id">) => `/api/files/${encodeURIComponent(file.id)}`;

type ThumbSize = "sm" | "md";

const SIZES: Record<ThumbSize, string> = {
  sm: "h-[52px] w-10 rounded-md",
  md: "h-[112px] w-[84px] rounded-lg",
};

/**
 * Invoice thumbnail beside an amount. Image → the photo; PDF/XML → a paper-like tile with the file
 * name (+ "e-invoice" chip when read from ZATCA XML); SADAD → biller tile; no file → muted tile.
 * Tapping opens the file full screen (inside the phone frame on /m).
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
  const base = cn("relative flex shrink-0 overflow-hidden border bg-card", SIZES[size], className);

  if (!file) {
    const sadad = bill.kind === "sadad";
    const Icon = sadad ? Landmark : FileX;
    return (
      <div className={cn(base, "flex-col items-center justify-center gap-1 bg-muted/60 text-muted-foreground")}>
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
  const isImage = file.mime === "image/jpeg" || file.mime === "image/png";

  if (isImage && !broken) {
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

  const Icon = isImage ? ImageIcon : file.mime === "application/xml" ? FileCode : FileText;
  if (size === "sm") {
    return (
      <span className={cn(className, "items-center justify-center text-primary")}>
        <PaperLines />
        <Icon className="relative size-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className={cn(className, "flex-col items-stretch gap-1 p-2 text-start")}>
      <PaperLines />
      <Icon className="relative size-5 text-primary" aria-hidden />
      <span dir="ltr" className="relative line-clamp-3 text-[10px] leading-tight break-all text-foreground">
        {file.name}
      </span>
      {eInvoice ? (
        <span className="relative mt-auto inline-flex h-4 w-fit items-center rounded-full bg-information px-1.5 text-[9px] font-medium text-information-foreground">
          {t.payments.eInvoice}
        </span>
      ) : null}
    </span>
  );
}

/** Faint ruled lines so a file tile reads as paper. */
function PaperLines() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-2 top-1/2 bottom-2 bg-[repeating-linear-gradient(to_bottom,var(--color-border)_0,var(--color-border)_1px,transparent_1px,transparent_7px)] opacity-70"
    />
  );
}

/** Full-screen file viewer (PDF in an iframe, image in an <img>). */
export function InvoiceViewer({ file, children }: { file: StoredFile; children: React.ReactNode }) {
  const t = useT();
  const container = usePortalContainer();
  const inFrame = Boolean(container);
  const isImage = file.mime === "image/jpeg" || file.mime === "image/png";
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
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              aria-label={t.payments.openInNewTab}
              title={t.payments.openInNewTab}
            >
              <ExternalLink aria-hidden />
            </a>
            <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={t.payments.close}>
              <XIcon aria-hidden />
            </Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/60">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- served by app/api, not a static asset
              <img src={url} alt={file.name} className="max-h-full max-w-full object-contain" />
            ) : (
              <iframe src={url} title={file.name} className="size-full border-0 bg-background" />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

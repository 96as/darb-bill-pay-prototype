"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCode, FileImage, FileText, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Bill } from "@/lib/domain/types";
import { useI18n, useT } from "@/lib/i18n/client";
import { api, errorMessage } from "@/lib/ui/api";
import { formatFileSize } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

/** Same list the server accepts (lib/domain/file-type.ts sniffs the content; this is only a first filter). */
export const INVOICE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.xml";
const ALLOWED = /\.(pdf|jpe?g|png|xml)$/i;
const MAX_BYTES = 10 * 1024 * 1024;

export function fileIconFor(name: string) {
  if (/\.xml$/i.test(name)) return FileCode;
  if (/\.(jpe?g|png)$/i.test(name)) return FileImage;
  return FileText;
}

/** POST /api/bills (multipart "file") → { bill, duplicate } → open the new bill (duplicate banner shows there). */
function useUploadInvoice(onDone?: () => void) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function upload(file: File) {
    setPending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.upload<{ bill: Pick<Bill, "id">; duplicate?: unknown }>("/api/bills", form);
      if (res.duplicate) toast.warning(t.upload.duplicate);
      else toast.success(t.upload.created);
      onDone?.();
      router.push(`/bills/${res.bill.id}`);
    } catch (error) {
      toast.error(errorMessage(error, lang));
    } finally {
      setPending(false);
    }
  }
  return { upload, pending };
}

/** Drop zone + file picker for one invoice file. */
export function UploadDropzone({ onDone, className }: { onDone?: () => void; className?: string }) {
  const t = useT();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const { upload, pending } = useUploadInvoice(onDone);

  function pick(next: File | undefined) {
    if (!next) return;
    if (!ALLOWED.test(next.name)) {
      setProblem(t.upload.wrongType);
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setProblem(t.upload.tooBig);
      setFile(null);
      return;
    }
    setProblem(null);
    setFile(next);
  }

  const Icon = file ? fileIconFor(file.name) : Upload;

  return (
    <div className={cn("grid gap-3", className)}>
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-surface text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" dir="ltr">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.upload.remove}
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            disabled={pending}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-background-secondary px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary-surface/40",
            dragging && "border-primary bg-primary-surface/60",
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-surface text-primary">
            <Upload className="size-5" aria-hidden />
          </span>
          <span className="text-sm">
            {t.upload.dropHere} <span className="font-medium text-primary underline-offset-4 hover:underline">{t.upload.browse}</span>
          </span>
          <span className="text-xs text-muted-foreground">{t.upload.accepted}</span>
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={INVOICE_ACCEPT}
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {problem ? (
        <p role="alert" className="text-sm text-error-foreground">
          {problem}
        </p>
      ) : null}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
        {t.upload.untrusted}
      </p>
      <div className="flex justify-end">
        <Button size="lg" className="px-4" disabled={!file || pending} onClick={() => file && upload(file)}>
          <Upload aria-hidden />
          {pending ? t.upload.uploading : t.upload.upload}
        </Button>
      </div>
    </div>
  );
}

/** Light-blue pill "Upload invoice" that opens the upload dialog. */
export function UploadInvoiceDialog({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="pill" size="lg" className={cn("px-4", className)} />}>
        <Upload aria-hidden />
        {t.bills.uploadInvoice}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.upload.title}</DialogTitle>
          <DialogDescription>{t.upload.description}</DialogDescription>
        </DialogHeader>
        <UploadDropzone onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

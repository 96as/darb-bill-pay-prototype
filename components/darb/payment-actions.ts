"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";

/** JSON error from app/api: `{ error: { code, message } }`. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function postJSON<T = unknown>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError("network", "", 0);
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(error?.code ?? `http_${res.status}`, error?.message ?? "", res.status);
  }
  return data as T;
}

/**
 * Runs a mutation against app/api: shows the server's message on error (toast), a success toast
 * otherwise, then `router.refresh()` so server components re-read the store.
 */
export function useApiAction() {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);

  const errorText = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.message) return err.message;
        if (err.status === 404 || err.status === 405) return t.payments.errors.notAvailable;
      }
      return t.payments.errors.generic;
    },
    [t],
  );

  const run = useCallback(
    async <T,>(
      key: string,
      url: string,
      body: unknown,
      opts: { success?: string; onSuccess?: (data: T) => void; refresh?: boolean } = {},
    ): Promise<T | undefined> => {
      setBusy(key);
      try {
        const data = await postJSON<T>(url, body);
        if (opts.success) toast.success(opts.success);
        opts.onSuccess?.(data);
        if (opts.refresh !== false) router.refresh();
        return data;
      } catch (err) {
        toast.error(errorText(err));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [router, errorText],
  );

  return { run, busy, errorText };
}

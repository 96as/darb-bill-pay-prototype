"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n/client";
import { errorMessage } from "./api";

/**
 * Runs a mutation: shows a pending state, toasts the API error message on failure,
 * and refreshes server data on success (BUILD-NOTES: client components mutate via fetch, then router.refresh()).
 * `pending` stays true until the refreshed page has rendered, so a slow load can't trigger a double submit.
 * Pass `navigateTo` to land on another page (e.g. the bill) instead of refreshing in place.
 */
export function useApiAction() {
  const router = useRouter();
  const lang = useLang();
  const [pending, setPending] = useState(false);
  const [refreshing, startTransition] = useTransition();

  const run = useCallback(
    async <T,>(
      action: () => Promise<T>,
      opts: { success?: string; refresh?: boolean; navigateTo?: string; onSuccess?: (result: T) => void } = {},
    ): Promise<T | undefined> => {
      setPending(true);
      try {
        const result = await action();
        if (opts.success) toast.success(opts.success);
        opts.onSuccess?.(result);
        if (opts.navigateTo) startTransition(() => router.push(opts.navigateTo!));
        else if (opts.refresh !== false) startTransition(() => router.refresh());
        return result;
      } catch (error) {
        toast.error(errorMessage(error, lang));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [router, lang],
  );

  return { run, pending: pending || refreshing };
}

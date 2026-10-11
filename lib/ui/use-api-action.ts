"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { errorMessage } from "./api";

/**
 * Runs a mutation: shows a pending state, toasts the API error message on failure,
 * and refreshes server data on success (BUILD-NOTES: client components mutate via fetch, then router.refresh()).
 */
export function useApiAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <T,>(
      action: () => Promise<T>,
      opts: { success?: string; refresh?: boolean; onSuccess?: (result: T) => void } = {},
    ): Promise<T | undefined> => {
      setPending(true);
      try {
        const result = await action();
        if (opts.success) toast.success(opts.success);
        opts.onSuccess?.(result);
        if (opts.refresh !== false) router.refresh();
        return result;
      } catch (error) {
        toast.error(errorMessage(error));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { run, pending };
}

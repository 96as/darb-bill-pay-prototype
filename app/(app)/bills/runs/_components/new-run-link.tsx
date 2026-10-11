"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/** Primary "New payment run" (links to /bills/runs/new, optionally preselecting bills). */
export function NewRunLink({ billIds, className }: { billIds?: string[]; className?: string }) {
  const t = useT();
  const href = billIds?.length ? `/bills/runs/new?bills=${billIds.map(encodeURIComponent).join(",")}` : "/bills/runs/new";
  return (
    <Link href={href} className={buttonVariants({ size: "lg", className: ["px-4", className].filter(Boolean).join(" ") })}>
      <Plus aria-hidden />
      {t.payments.runs.newRun}
    </Link>
  );
}

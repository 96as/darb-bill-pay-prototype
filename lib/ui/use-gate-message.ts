"use client";

import { useI18n } from "@/lib/i18n/client";
import type { Gate } from "./store-helpers";

/** Text for a denied permission gate: the domain message in English, a translation in Arabic. */
export function useGateMessage() {
  const { t, lang } = useI18n();
  return (gate: Gate | undefined): string | undefined => {
    if (!gate || gate.ok) return undefined;
    if (lang === "ar") return (gate.code && t.permissions[gate.code]) || gate.message;
    return gate.message ?? (gate.code ? t.permissions[gate.code] : undefined);
  };
}

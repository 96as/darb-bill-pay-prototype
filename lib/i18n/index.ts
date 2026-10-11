// Shared entry point (server and client). Server-only helpers live in ./server.ts,
// the React provider and hooks in ./client.tsx.
import { ar } from "./dictionaries/ar";
import { arPayments } from "./dictionaries/ar-payments";
import { en, type Dict as CoreDict } from "./dictionaries/en";
import { enPayments, type PaymentsDict } from "./dictionaries/en-payments";
import type { Lang } from "./config";

export * from "./config";
export { fmt, plural, type PluralForms } from "./format";

/** Core strings (en.ts / ar.ts) plus `payments` (runs, payment section, mobile; en-payments.ts / ar-payments.ts). */
export type Dict = CoreDict & { payments: PaymentsDict };

const dictionaries: Record<Lang, Dict> = {
  en: { ...en, payments: enPayments },
  ar: { ...ar, payments: arPayments },
};

export function getDict(lang: Lang): Dict {
  return dictionaries[lang];
}

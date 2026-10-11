// Shared entry point (server and client). Server-only helpers live in ./server.ts,
// the React provider and hooks in ./client.tsx.
import { ar } from "./dictionaries/ar";
import { en, type Dict } from "./dictionaries/en";
import type { Lang } from "./config";

export * from "./config";
export { fmt, plural, type PluralForms } from "./format";
export type { Dict };

const dictionaries: Record<Lang, Dict> = { en, ar };

export function getDict(lang: Lang): Dict {
  return dictionaries[lang];
}

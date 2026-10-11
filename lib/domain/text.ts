// Small text helpers shared by the parsers (Arabic digits, bidi marks, script detection).

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0; // ۰ (Persian/Urdu forms)

/** Converts Arabic-Indic digits and Arabic separators (٫ ٬) to Latin ("٤٥٬٠٠٠٫٠٠" → "45,000.00"). */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - EXTENDED_ARABIC_INDIC_ZERO))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

/** Removes zero-width and bidi control characters that ride along when copying from Arabic UIs. */
export function stripInvisible(s: string): string {
  return s.replace(/[​-‏‪-‮⁦-⁩﻿]/g, "");
}

const ARABIC_LETTER = /[ء-يٱ-ۓۺ-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ]/g;
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/g;

export function hasArabic(s: string): boolean {
  return countMatches(s, ARABIC_LETTER) > 0;
}

/** Dominant script of a piece of text by letter count; "none" when it has no letters. */
export function scriptOf(s: string): "arabic" | "latin" | "none" {
  const ar = countMatches(s, ARABIC_LETTER);
  const lat = countMatches(s, LATIN_LETTER);
  if (ar === 0 && lat === 0) return "none";
  return ar >= lat ? "arabic" : "latin";
}

function countMatches(s: string, re: RegExp): number {
  return s.match(re)?.length ?? 0;
}

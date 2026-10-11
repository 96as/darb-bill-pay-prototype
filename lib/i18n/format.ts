import type { Lang } from "./config";

/** Plural forms keyed by CLDR category. `other` is required; Arabic also uses zero/one/two/few/many. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Replace `{name}` placeholders. Missing values are left as-is so they are easy to spot. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

const rulesCache = new Map<Lang, Intl.PluralRules>();

/** Pick the plural form for `count` and fill `{count}` (plus any extra vars). */
export function plural(
  lang: Lang,
  forms: PluralForms,
  count: number,
  vars: Record<string, string | number> = {},
): string {
  let rules = rulesCache.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    rulesCache.set(lang, rules);
  }
  // Explicit 0 form first (English has no CLDR "zero" category but may want one).
  const category = count === 0 && forms.zero ? "zero" : rules.select(count);
  const template = forms[category] ?? forms.other;
  return fmt(template, { count, ...vars });
}

// Shared by the server loader and the client log (no server imports here).
export const ACTIVITY_FILTERS = ["all", "bill", "supplier", "payment", "run", "email"] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

export function parseActivityFilter(v: string | string[] | undefined): ActivityFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return (ACTIVITY_FILTERS as readonly string[]).includes(s ?? "") ? (s as ActivityFilter) : "all";
}

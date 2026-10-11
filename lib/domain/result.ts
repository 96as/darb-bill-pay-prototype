// Shared result shape for pure rule checks (permissions, limits, gates).

export type RuleOk = { ok: true };
export type RuleDenied<C extends string = string> = {
  ok: false;
  code: C;
  message: string;
  /** Set when a check over several bills (a run) fails on one of them. */
  billId?: string;
};
export type RuleResult<C extends string = string> = RuleOk | RuleDenied<C>;

export const allow = (): RuleOk => ({ ok: true });

export function deny<C extends string>(code: C, message: string, billId?: string): RuleDenied<C> {
  return billId === undefined ? { ok: false, code, message } : { ok: false, code, message, billId };
}

"use client";

import { useDemoState } from "@/components/darb/shell/demo-state";
import { useT } from "@/lib/i18n/client";
import type { GateLike, Unblock } from "./gated-button";

/** Codes that another user can get past: the fix is to act as someone else (demo user switcher). */
const SWITCH_USER = new Set([
  "not_approver",
  "creator_cannot_approve",
  "editor_cannot_approve",
  "submitter_cannot_approve",
  "requester_cannot_approve",
  "maker_cannot_confirm",
  "supplier_creator_cannot_approve_first_payment",
  "iban_changer_cannot_approve_first_payment",
  "run_creator_cannot_approve",
  "run_editor_cannot_approve",
  "run_submitter_cannot_approve",
]);

export interface UnblockContext {
  billId?: string;
  supplierId?: string;
  markChecked?: () => void;
  dismissDuplicate?: () => void;
  confirmMatch?: () => void;
}

/** Maps a denied gate to the action that unblocks it on the current screen (or undefined if none fits). */
export function useUnblock() {
  const t = useT();
  const { setSwitcherOpen } = useDemoState();
  return (gate: GateLike | undefined, ctx: UnblockContext = {}): Unblock | undefined => {
    if (!gate || gate.ok || !gate.code) return undefined;
    const code = gate.code;
    if (SWITCH_USER.has(code)) return { label: t.shell.switchUser, onClick: () => setSwitcherOpen(true) };
    if (code === "iban_change_pending" && ctx.supplierId) {
      return { label: t.billDetail.supplier.view, href: `/bills/suppliers/${ctx.supplierId}` };
    }
    if (code === "supplier_not_linked" && ctx.billId) {
      return { label: t.billDetail.supplier.addSupplier, href: `/bills/suppliers/new?fromBill=${ctx.billId}` };
    }
    if (code === "needs_review" && ctx.markChecked) return { label: t.billDetail.banners.markChecked, onClick: ctx.markChecked };
    if (code === "duplicate_unresolved" && ctx.dismissDuplicate) {
      return { label: t.billDetail.banners.notDuplicate, onClick: ctx.dismissDuplicate };
    }
    if (code === "name_check_unconfirmed") {
      if (ctx.confirmMatch) return { label: t.suppliers.detail.confirmMatch, onClick: ctx.confirmMatch };
      if (ctx.supplierId) return { label: t.billDetail.supplier.view, href: `/bills/suppliers/${ctx.supplierId}` };
    }
    return undefined;
  };
}

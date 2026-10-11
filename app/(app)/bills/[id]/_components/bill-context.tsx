"use client";

import { createContext, useContext, useState } from "react";
import type { BillDetailView } from "../data";

interface BillCtx {
  view: BillDetailView;
  editing: boolean;
  setEditing: (editing: boolean) => void;
}

const Ctx = createContext<BillCtx | null>(null);

/** Shares the bill view and the fields card's edit mode (the OCR banner can open it). */
export function BillProvider({ view, children }: { view: BillDetailView; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  return <Ctx.Provider value={{ view, editing, setEditing }}>{children}</Ctx.Provider>;
}

export function useBill(): BillCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBill must be used inside <BillProvider>");
  return ctx;
}

/** Editable while the bill can still change before payment (BP-08: edits restart approval). */
export const isEditable = (view: BillDetailView) =>
  view.bill.status === "draft" || view.bill.status === "awaiting_approval";

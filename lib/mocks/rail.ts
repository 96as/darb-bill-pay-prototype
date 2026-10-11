// Mock payment rail (PL-04). Idempotent by request key: a repeated key returns the first answer and never
// adds a second ledger row, so a retry can never send money twice (PRD 3 "Never pay twice").
import type { Halalas, Rail, StoreData } from "@/lib/domain/types";
import { normalizeIban } from "@/lib/domain/iban";
import { riyadhDate } from "@/lib/domain/time";
import { sarieSendTime } from "@/lib/domain/rails";

/** The beneficiary bank returns payments to this IBAN (failure demo, tests only). */
export const RETURNED_IBAN = "SA2820000000003300776655";

export interface RailRequest {
  requestKey: string;
  amount: Halalas;
  rail: Rail;
  iban?: string;
  sadad?: { billerCode: string; billNumber: string };
}

export interface RailResult {
  transferRef: string;
  status: "settled" | "returned";
  at: string;
  /** True when the key was seen before: nothing was sent this time. */
  duplicate: boolean;
}

export interface PaymentRail {
  send(req: RailRequest, store: StoreData, now: Date): RailResult;
}

export class RailRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RailRejectedError";
  }
}

export function createMockRail(): PaymentRail {
  return {
    send(req, store, now) {
      const seen = store.railLedger.find((row) => row.requestKey === req.requestKey);
      if (seen) return { transferRef: seen.transferRef, status: seen.status ?? "settled", at: seen.at, duplicate: true };

      if (!Number.isSafeInteger(req.amount) || req.amount <= 0) throw new RailRejectedError("Amount must be a positive number of halalas");
      if (req.rail !== "sadad" && !req.iban) throw new RailRejectedError("A bank transfer needs an IBAN");
      // The real SARIE refuses outside its window; the scheduler must never ask.
      if (req.rail === "sarie" && sarieSendTime(now).reason !== "sarie_in_window") {
        throw new RailRejectedError("SARIE is closed (Sun-Thu 09:00-15:58 Riyadh)");
      }

      const status = req.iban && normalizeIban(req.iban) === RETURNED_IBAN ? "returned" : "settled";
      const seq = String(100 + store.railLedger.length + 1).padStart(6, "0");
      const transferRef = `DRB-${riyadhDate(now).replace(/-/g, "")}-${seq}`;
      const at = now.toISOString();
      store.railLedger.push({ requestKey: req.requestKey, transferRef, at, status, amount: req.amount });
      return { transferRef, status, at, duplicate: false };
    },
  };
}

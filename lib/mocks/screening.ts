// Mock payee screening (BP-06; PRD open question 7): every new payee clears.
import type { Supplier } from "@/lib/domain/types";

export interface PayeeScreening {
  screen(supplier: Pick<Supplier, "nameEn" | "vatNumber" | "iban">, now: Date): Supplier["screening"];
}

export function createClearingScreening(): PayeeScreening {
  return {
    screen(_supplier, now) {
      return { status: "cleared", checkedAt: now.toISOString() };
    },
  };
}

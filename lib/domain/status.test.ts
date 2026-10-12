import { describe, expect, it } from "vitest";
import { BILL_TRANSITIONS, InvalidTransitionError, assertTransition, canTransition, displayStatus, isOverdue } from "./status";
import type { BillStatus } from "./types";

const TODAY = "2026-10-15";

describe("displayStatus", () => {
  it("shows Overdue for unpaid bills past due (the seed draft due 2026-10-14)", () => {
    expect(displayStatus({ status: "draft", dueDate: "2026-10-14" }, TODAY)).toBe("overdue");
    for (const status of ["awaiting_approval", "scheduled", "failed"] as const) {
      expect(displayStatus({ status, dueDate: "2026-10-01" }, TODAY)).toBe("overdue");
    }
  });

  it("is not overdue on the due date itself or later", () => {
    expect(displayStatus({ status: "draft", dueDate: TODAY }, TODAY)).toBe("draft");
    expect(displayStatus({ status: "scheduled", dueDate: "2026-11-12" }, TODAY)).toBe("scheduled");
  });

  it("never marks paid or cancelled bills, or bills without a due date", () => {
    expect(displayStatus({ status: "paid", dueDate: "2026-09-24" }, TODAY)).toBe("paid");
    expect(displayStatus({ status: "cancelled", dueDate: "2026-09-24" }, TODAY)).toBe("cancelled");
    expect(displayStatus({ status: "draft" }, TODAY)).toBe("draft");
    expect(isOverdue({ status: "draft" }, TODAY)).toBe(false);
  });
});

describe("transitions", () => {
  it("allows the main journey", () => {
    const path: BillStatus[] = ["draft", "awaiting_approval", "scheduled", "paid"];
    for (let i = 1; i < path.length; i++) expect(() => assertTransition(path[i - 1], path[i])).not.toThrow();
  });

  it("allows restarts, retries, returns and cancellation until sent", () => {
    expect(canTransition("awaiting_approval", "draft")).toBe(true);
    expect(canTransition("scheduled", "awaiting_approval")).toBe(true);
    expect(canTransition("scheduled", "failed")).toBe(true);
    expect(canTransition("failed", "scheduled")).toBe(true);
    expect(canTransition("paid", "failed")).toBe(true);
    for (const from of ["draft", "awaiting_approval", "scheduled", "failed"] as const) {
      expect(canTransition(from, "cancelled")).toBe(true);
    }
  });

  it("allows draft → discarded, and nothing out of discarded", () => {
    expect(canTransition("draft", "discarded")).toBe(true);
    expect(canTransition("awaiting_approval", "discarded")).toBe(false);
    expect(BILL_TRANSITIONS.discarded).toEqual([]);
    expect(displayStatus({ status: "discarded", dueDate: "2026-10-01" }, TODAY)).toBe("discarded"); // never overdue
  });

  it("refuses shortcuts and anything out of cancelled", () => {
    expect(canTransition("draft", "scheduled")).toBe(false);
    expect(canTransition("draft", "paid")).toBe(false);
    expect(canTransition("awaiting_approval", "paid")).toBe(false);
    expect(canTransition("paid", "cancelled")).toBe(false);
    expect(BILL_TRANSITIONS.cancelled).toEqual([]);
    expect(() => assertTransition("cancelled", "draft")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("draft", "draft")).toThrow("A bill cannot move from draft to draft");
  });
});

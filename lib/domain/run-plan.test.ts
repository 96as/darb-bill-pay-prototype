import { describe, expect, it } from "vitest";
import { planRunExecution, retryAt, retryDate, shortfallByAccount } from "./run-plan";
import { sar } from "./money";

const p = (id: string, amount: number, dueDate?: string, fundingAccountId = "main") => ({
  id,
  amount: sar(amount),
  dueDate,
  fundingAccountId,
});

describe("planRunExecution (BP-10 short balance)", () => {
  it("sends everything when the balance covers the run, in due-date order", () => {
    const plan = planRunExecution([p("hvac", 45000, "2026-11-12"), p("land", 8050, "2026-10-25"), p("old", 12500, "2026-10-14")], {
      main: sar(180000),
    });
    expect(plan.send.map((x) => x.id)).toEqual(["old", "land", "hvac"]);
    expect(plan.hold).toEqual([]);
    expect(plan.remainingByAccount.main).toBe(sar(180000 - 65550));
  });

  it("holds a payment that does not fit and still pays later ones that do", () => {
    const plan = planRunExecution([p("a", 30000, "2026-10-20"), p("b", 50000, "2026-10-21"), p("c", 15000, "2026-10-22")], {
      main: sar(50000),
    });
    expect(plan.send.map((x) => x.id)).toEqual(["a", "c"]);
    expect(plan.hold.map((x) => x.id)).toEqual(["b"]);
    expect(plan.remainingByAccount.main).toBe(sar(5000));
  });

  it("pays the earliest due first when both cannot fit", () => {
    const plan = planRunExecution([p("later", 30000, "2026-10-30"), p("sooner", 30000, "2026-10-20")], { main: sar(40000) });
    expect(plan.send.map((x) => x.id)).toEqual(["sooner"]);
    expect(plan.hold.map((x) => x.id)).toEqual(["later"]);
  });

  it("keeps input order for equal due dates and puts missing due dates last", () => {
    const plan = planRunExecution([p("x", 1, undefined), p("y", 1, "2026-10-20"), p("z", 1, "2026-10-20")], { main: sar(10) });
    expect(plan.send.map((x) => x.id)).toEqual(["y", "z", "x"]);
  });

  it("checks each funding account separately; unknown accounts have no balance", () => {
    const plan = planRunExecution(
      [p("main1", 30000, "2026-10-20"), p("sub1", 30000, "2026-10-20", "sw_maint"), p("sub2", 10000, "2026-10-21", "sw_maint"), p("ghost", 1, "2026-10-20", "nope")],
      { main: sar(180000), sw_maint: sar(40000) },
    );
    expect(plan.send.map((x) => x.id)).toEqual(["main1", "sub1", "sub2"]);
    expect(plan.hold.map((x) => x.id)).toEqual(["ghost"]);
    expect(plan.remainingByAccount).toEqual({ main: sar(150000), sw_maint: 0 });
  });

  it("does not mutate the inputs", () => {
    const balances = { main: sar(10) };
    const payments = [p("b", 5, "2026-10-21"), p("a", 5, "2026-10-20")];
    planRunExecution(payments, balances);
    expect(balances).toEqual({ main: sar(10) });
    expect(payments.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("retry", () => {
  it("retries on the next working day at 09:00 Riyadh", () => {
    expect(retryDate("2026-10-15")).toBe("2026-10-18"); // Thu → Sun
    expect(retryDate("2026-10-18")).toBe("2026-10-19");
    expect(retryAt("2026-10-15").toISOString()).toBe("2026-10-18T06:00:00.000Z");
  });
});

describe("shortfallByAccount (day-before alert)", () => {
  it("reports only short accounts", () => {
    expect(
      shortfallByAccount([p("a", 30000), p("b", 20000, undefined, "sw_maint"), p("c", 25000, undefined, "sw_maint")], {
        main: sar(180000),
        sw_maint: sar(40000),
      }),
    ).toEqual({ sw_maint: sar(5000) });
    expect(shortfallByAccount([], { main: 0 })).toEqual({});
  });
});

// Demo controls: the clock (time only moves forward; the scheduler runs after every move), the acting user.
import type { User } from "@/lib/domain/types";
import { riyadhParts, weekdayName } from "@/lib/domain/time";
import type { Ctx } from "../context";
import { getUser } from "../context";
import { invalid } from "../errors";
import { audit } from "../audit";
import { runScheduler, type SchedulerReport } from "./scheduler";

export interface DemoState {
  now: string;
  riyadh: { date: string; time: string; weekday: string; weekdayAr: string };
  session: { userId: string; user: Pick<User, "id" | "name" | "nameAr" | "title" | "titleAr" | "role"> };
  users: Pick<User, "id" | "name" | "nameAr" | "title" | "titleAr" | "role">[];
  company: { name: string; nameAr: string; inboxAddress: string; makerChecker: boolean };
}

const pickUser = ({ id, name, nameAr, title, titleAr, role }: User) => ({ id, name, nameAr, title, titleAr, role });

export function demoState(ctx: Ctx): DemoState {
  const p = riyadhParts(ctx.now);
  const user = getUser(ctx, ctx.store.session.userId);
  return {
    now: ctx.now.toISOString(),
    riyadh: { date: p.date, time: p.time, weekday: weekdayName(p.date), weekdayAr: weekdayName(p.date, "ar") },
    session: { userId: user.id, user: pickUser(user) },
    users: ctx.store.users.map(pickUser),
    company: {
      name: ctx.store.company.name,
      nameAr: ctx.store.company.nameAr,
      inboxAddress: ctx.store.company.inboxAddress,
      makerChecker: ctx.store.company.makerChecker,
    },
  };
}

/** Moves the demo clock forward and runs the scheduler (payments due by then are sent or held). */
export function setClock(ctx: Ctx, iso: string, actorId: string): { state: DemoState; scheduler: SchedulerReport } {
  const t = Date.parse(iso);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso) || Number.isNaN(t)) throw invalid("invalid_time", "Give the time as an ISO date-time, e.g. 2026-10-18T06:00:00.000Z");
  if (t < ctx.now.getTime()) throw invalid("clock_backwards", "The demo clock only moves forward; use Reset to start over");
  const before = ctx.store.clock.now;
  ctx.now = new Date(t);
  ctx.store.clock.now = ctx.now.toISOString();
  audit(ctx, actorId, "demo.clock_set", { type: "company", id: ctx.store.company.id }, { now: before }, { now: ctx.store.clock.now });
  const scheduler = runScheduler(ctx);
  return { state: demoState(ctx), scheduler };
}

export function setUser(ctx: Ctx, userId: string): DemoState {
  getUser(ctx, userId);
  ctx.store.session.userId = userId;
  return demoState(ctx);
}

/** Back to the seed (persists to data/store.json). */
export { resetStore as reset } from "../store";

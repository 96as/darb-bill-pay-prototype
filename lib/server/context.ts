// Every service takes (ctx, ...args). ctx.now is the demo clock: services never read the system clock.
import type { StoreData, User } from "@/lib/domain/types";
import { createMocks, type Mocks } from "@/lib/mocks";
import { memoryFiles, type FileStore } from "./files";
import { ServiceError, notFound } from "./errors";
import { riyadhDate } from "@/lib/domain/time";

export interface Ctx {
  store: StoreData;
  now: Date;
  mocks: Mocks;
  files: FileStore;
}

/** Builds a context on a store. Defaults: mocks from createMocks(), in-memory uploads (tests); the API passes diskFiles. */
export function makeCtx(store: StoreData, overrides: Partial<Pick<Ctx, "mocks" | "files">> = {}): Ctx {
  return {
    store,
    now: new Date(store.clock.now),
    mocks: overrides.mocks ?? createMocks(),
    files: overrides.files ?? memoryFiles(),
  };
}

export const nowIso = (ctx: Ctx) => ctx.now.toISOString();
export const today = (ctx: Ctx) => riyadhDate(ctx.now);

export function getUser(ctx: Ctx, id: string): User {
  const user = ctx.store.users.find((u) => u.id === id);
  if (!user) throw new ServiceError("unknown_user", `User ${id} does not exist`, 403);
  return user;
}

/** Acting user of the demo session (the user switcher). */
export const sessionUserId = (ctx: Ctx) => ctx.store.session.userId;

export const approverIds = (ctx: Ctx) => ctx.store.users.filter((u) => u.role === "approver").map((u) => u.id);

/** Money alerts go to the finance admin (BUILD-NOTES 11): users who prepare. */
export function financeAdminIds(ctx: Ctx): string[] {
  const ids = ctx.store.users.filter((u) => u.role === "preparer").map((u) => u.id);
  return ids.length > 0 ? ids : ctx.store.users.slice(0, 1).map((u) => u.id);
}

export function getAccount(ctx: Ctx, id: string) {
  const account = ctx.store.accounts.find((a) => a.id === id);
  if (!account) throw notFound("Account", id);
  return account;
}

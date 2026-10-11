// Full audit trail (PRD 3 platform rules): who, when, and the before and after values.
import type { AuditEvent } from "@/lib/domain/types";
import type { Ctx } from "./context";
import { newId } from "./ids";

const snapshot = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as unknown));

export function audit(
  ctx: Ctx,
  actorId: string,
  action: string,
  entity: AuditEvent["entity"],
  before?: unknown,
  after?: unknown,
): AuditEvent {
  const event: AuditEvent = {
    id: newId(ctx.store, "ev"),
    at: ctx.now.toISOString(),
    actorId,
    action,
    entity,
    ...(before !== undefined ? { before: snapshot(before) } : {}),
    ...(after !== undefined ? { after: snapshot(after) } : {}),
  };
  ctx.store.audit.push(event);
  return event;
}

export function auditFor(ctx: Ctx, type: AuditEvent["entity"]["type"], id: string): AuditEvent[] {
  return ctx.store.audit.filter((e) => e.entity.type === type && e.entity.id === id);
}

// Bills inbox (BP-02): each attachment of a forwarded email becomes its own draft; the sender is saved.
import type { Bill, InboundEmail } from "@/lib/domain/types";
import { canPrepare } from "@/lib/domain/permissions";
import type { Ctx } from "../context";
import { getUser } from "../context";
import { ServiceError, ensure, notFound } from "../errors";
import { audit } from "../audit";
import { ingestFile } from "./bills";

export interface EmailRow {
  email: InboundEmail;
  bills: Pick<Bill, "id" | "invoiceNumber" | "supplierName" | "total" | "status" | "extraction" | "duplicateOf">[];
}

export function listEmails(ctx: Ctx): { address: string; emails: EmailRow[] } {
  return {
    address: ctx.store.company.inboxAddress,
    emails: ctx.mocks.mailbox.list(ctx.store).map((email) => ({
      email,
      bills: email.billIds
        .map((id) => ctx.store.bills.find((b) => b.id === id))
        .filter((b): b is Bill => !!b)
        .map(({ id, invoiceNumber, supplierName, total, status, extraction, duplicateOf }) => ({ id, invoiceNumber, supplierName, total, status, extraction, duplicateOf })),
    })),
  };
}

export interface ProcessResult {
  email: InboundEmail;
  bills: Bill[];
  errors: { filename: string; code: string; message: string }[];
  alreadyProcessed: boolean;
}

/** Idempotent: processing an email twice returns the bills of the first time. */
export async function processEmail(ctx: Ctx, emailId: string, actorId: string): Promise<ProcessResult> {
  ensure(canPrepare(getUser(ctx, actorId)));
  const email = ctx.mocks.mailbox.get(ctx.store, emailId);
  if (!email) throw notFound("Email", emailId);
  if (email.processedAt) {
    const bills = email.billIds.map((id) => ctx.store.bills.find((b) => b.id === id)).filter((b): b is Bill => !!b);
    return { email, bills, errors: [], alreadyProcessed: true };
  }
  const bills: Bill[] = [];
  const errors: ProcessResult["errors"] = [];
  for (const attachment of email.attachments) {
    let bytes: Uint8Array;
    try {
      bytes = await ctx.mocks.mailbox.readAttachment(ctx.files, attachment);
    } catch {
      errors.push({ filename: attachment.filename, code: "attachment_unreadable", message: "The attachment could not be read" });
      continue;
    }
    try {
      const { bill } = await ingestFile(ctx, {
        bytes,
        filename: attachment.filename,
        source: "email",
        emailId: email.id,
        senderEmail: email.from,
        actorId: "system",
        existingPath: attachment.path,
      });
      bills.push(bill);
    } catch (err) {
      if (!(err instanceof ServiceError)) throw err;
      errors.push({ filename: attachment.filename, code: err.code, message: err.message });
    }
  }
  email.processedAt = ctx.now.toISOString();
  email.billIds = bills.map((b) => b.id);
  audit(ctx, actorId, "email.processed", { type: "email", id: email.id }, undefined, { billIds: email.billIds, errors });
  return { email, bills, errors, alreadyProcessed: false };
}

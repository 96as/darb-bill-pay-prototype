import type { Bill, DisplayStatus, Halalas, InboundEmail } from "@/lib/domain/types";
import { riyadhDate } from "@/lib/ui/format";
import { displayStatus } from "@/lib/ui/status";
import { readStore } from "../../store";

export interface InboxBill {
  id: string;
  supplierName: string;
  supplierNameAr?: string;
  invoiceNumber: string;
  extraction: Bill["extraction"];
  needsReviewCount: number;
  total: Halalas;
  status: DisplayStatus;
  duplicate: boolean;
}

export interface InboxEmail {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  processedAt?: string;
  attachments: InboundEmail["attachments"];
  bills: InboxBill[];
}

export interface InboxView {
  address: string;
  emails: InboxEmail[];
}

export async function loadInboxView(): Promise<InboxView> {
  const store = await readStore();
  const today = riyadhDate(store.clock.now);
  const emails = [...store.emails]
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .map((email) => ({
      id: email.id,
      from: email.from,
      subject: email.subject,
      receivedAt: email.receivedAt,
      processedAt: email.processedAt,
      attachments: email.attachments,
      bills: store.bills
        .filter((b) => email.billIds.includes(b.id) || b.emailId === email.id)
        .map((b) => ({
          id: b.id,
          supplierName: b.supplierName,
          supplierNameAr: b.supplierNameAr,
          invoiceNumber: b.invoiceNumber,
          extraction: b.extraction,
          needsReviewCount: b.needsReview.length,
          total: b.total,
          status: displayStatus(b, today),
          duplicate: !!b.duplicateOf,
        })),
    }));
  return { address: store.company.inboxAddress, emails };
}

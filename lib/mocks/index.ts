// Every external system the prototype fakes, behind one interface each. All are labelled "Mock" in the UI.
import { createFixtureOcr, type OcrService } from "./ocr";
import { createFixedNameCheck, type NameCheckService } from "./name-check";
import { createClearingScreening, type PayeeScreening } from "./screening";
import { createMockRail, type PaymentRail } from "./rail";
import { createMockMailbox, createMockNoticeSender, type InboundMailbox, type NoticeSender } from "./email";
import { createMockAccounting, type AccountingSync } from "./accounting";

export interface Mocks {
  ocr: OcrService;
  nameCheck: NameCheckService;
  screening: PayeeScreening;
  rail: PaymentRail;
  mailbox: InboundMailbox;
  notices: NoticeSender;
  accounting: AccountingSync;
}

export function createMocks(overrides: Partial<Mocks> = {}): Mocks {
  return {
    ocr: createFixtureOcr(),
    nameCheck: createFixedNameCheck(),
    screening: createClearingScreening(),
    rail: createMockRail(),
    mailbox: createMockMailbox(),
    notices: createMockNoticeSender(),
    accounting: createMockAccounting(),
    ...overrides,
  };
}

export type { OcrService, NameCheckService, PayeeScreening, PaymentRail, InboundMailbox, NoticeSender, AccountingSync };

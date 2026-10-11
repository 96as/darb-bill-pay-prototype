// Mock email: the bills inbox (BP-02) and outgoing supplier notices (BP-13). Nothing leaves the machine.
import type { InboundEmail, StoreData, SupplierNotice } from "@/lib/domain/types";
import type { FileStore } from "@/lib/server/files";

export interface NoticeSender {
  /** Records the notice; the mock "delivers" it instantly. */
  send(store: StoreData, notice: SupplierNotice): { status: "delivered (mock)" };
}

export function createMockNoticeSender(): NoticeSender {
  return {
    send(store, notice) {
      store.notices.push(notice);
      return { status: "delivered (mock)" };
    },
  };
}

export interface InboundMailbox {
  list(store: StoreData): InboundEmail[];
  get(store: StoreData, id: string): InboundEmail | undefined;
  readAttachment(files: FileStore, attachment: InboundEmail["attachments"][number]): Promise<Uint8Array>;
}

export function createMockMailbox(): InboundMailbox {
  return {
    list: (store) => [...store.emails].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    get: (store, id) => store.emails.find((e) => e.id === id),
    // Attachments of the seeded email are fixture files; FileStore refuses paths outside fixtures/ and data/files/.
    readAttachment: (files, attachment) => files.read(attachment.path),
  };
}

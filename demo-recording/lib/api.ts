// The demo API, for resets, user switches, clock jumps and off-camera setup.
import fs from "node:fs";
import path from "node:path";
import { BASE } from "./config";

async function call<T = any>(method: string, p: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }
  const res = await fetch(BASE + p, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${method} ${p} → ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export type UserId = "u_noura" | "u_faisal" | "u_reem";

export const api = {
  get: <T = any>(p: string) => call<T>("GET", p),
  post: <T = any>(p: string, body?: unknown) => call<T>("POST", p, body),
  patch: <T = any>(p: string, body?: unknown) => call<T>("PATCH", p, body),
  reset: () => call("POST", "/api/demo/reset"),
  user: (userId: UserId) => call("POST", "/api/demo/user", { userId }),
  clock: (date: string, time: string) => call("POST", "/api/demo/clock", { date, time }),
  state: () => call("GET", "/api/demo/state"),
  async upload(file: string) {
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(file)]), path.basename(file));
    return call("POST", "/api/bills", form);
  },
  async bill(id: string) {
    const d = await call("GET", `/api/bills/${id}`);
    return d.bill ?? d;
  },
};

/** Cool Breeze, as the supplier form saves it when prefilled from the e-invoice. */
export const COOL_BREEZE = {
  nameEn: "Cool Breeze HVAC Contracting Co.",
  nameAr: "شركة النسيم البارد للمقاولات والتكييف",
  vatNumber: "310387452600003",
  crNumber: "1010932185",
  iban: "SA6710000000020315550044",
  noticeEmail: "finance@coolbreeze-hvac.example",
};

export const IBAN = {
  clean: "SA2045000000001234567001",
  closeMatch: "SA0405000000008800112233",
};

// Human-looking browser actions plus the scene log: smooth 25-step mouse moves, 60 ms typing,
// smooth scrolling, holds, and zoom / text marks with element boxes in video pixels.
import fs from "node:fs";
import path from "node:path";
import type { Locator, Page } from "playwright";
import { BASE } from "./config";
import type { SceneLog, TextOverlay } from "./log";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class SceneFailure extends Error {}

export type ZoomOpts = {
  name: string;
  selector?: string;
  scale?: number;
  ms?: number;
  text?: string;
  subtitle?: string;
  position?: TextOverlay["position"];
  /** Extra CSS px around the element's box. */
  pad?: number;
  /** "text": the box hugs the element's visible text instead of its full (often full-width) box. */
  fit?: "box" | "text";
  /** Extend the box to include these elements too. */
  to?: Locator | Locator[];
};

type Rect = { x: number; y: number; width: number; height: number };

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

/** The union of the visible text's line boxes inside an element (CSS px). */
async function textBox(el: Locator): Promise<Rect | null> {
  return el.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent || !n.textContent.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const c of Array.from(r.getClientRects())) {
        if (c.width === 0 || c.height === 0) continue;
        x0 = Math.min(x0, c.left); y0 = Math.min(y0, c.top); x1 = Math.max(x1, c.right); y1 = Math.max(y1, c.bottom);
      }
    }
    // Icons and controls (svg, buttons) count too.
    for (const e of Array.from(root.querySelectorAll("svg, button, input, img, canvas"))) {
      const c = e.getBoundingClientRect();
      if (c.width === 0 || c.height === 0) continue;
      x0 = Math.min(x0, c.left); y0 = Math.min(y0, c.top); x1 = Math.max(x1, c.right); y1 = Math.max(y1, c.bottom);
    }
    return x0 === Infinity ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  });
}

export class Director {
  t0 = Date.now();
  x: number;
  y: number;

  constructor(
    public page: Page,
    public log: SceneLog,
    public opts: { fast: boolean; dpr: number; shotDir: string; mobile?: boolean },
    cursor: { x: number; y: number },
  ) {
    this.x = cursor.x;
    this.y = cursor.y;
  }

  now() {
    return Date.now() - this.t0;
  }

  private pause(ms: number) {
    return sleep(this.opts.fast ? Math.min(ms, 40) : ms);
  }

  // ---------- checks (fail fast, with a clear message) ----------

  async see(target: Locator | string, what: string, timeout = 15_000) {
    const loc = typeof target === "string" ? this.page.getByText(target, { exact: false }).first() : target.first();
    try {
      await loc.waitFor({ state: "visible", timeout });
    } catch {
      throw new SceneFailure(`[${this.log.id}] expected to see ${what}`);
    }
    return loc;
  }

  async notSee(target: Locator, what: string, timeout = 8_000) {
    try {
      await target.first().waitFor({ state: "hidden", timeout });
    } catch {
      throw new SceneFailure(`[${this.log.id}] expected ${what} to be gone`);
    }
  }

  check(ok: boolean, what: string) {
    if (!ok) throw new SceneFailure(`[${this.log.id}] ${what}`);
  }

  // ---------- pacing ----------

  async hold(ms: number, reason: string) {
    this.log.holds.push({ at_ms: this.now(), duration_ms: ms, reason });
    await this.pause(ms);
  }

  /** Waits for the page to settle; anything over 400 ms is logged as a cut (page load). */
  async settle(reason = "page load", from = this.now()) {
    await this.page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await this.waitPdf();
    await sleep(150);
    const to = this.now();
    if (to - from > 400) this.log.cuts.push({ from_ms: from + 150, to_ms: to, action: "cut", reason });
  }

  /** Waits for pdf.js previews on screen to finish drawing. */
  async waitPdf() {
    await this.page
      .waitForFunction(
        () => {
          const busy = document.querySelectorAll('[aria-busy="true"]').length;
          return busy === 0;
        },
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => {});
  }

  // ---------- mouse ----------

  async moveTo(x: number, y: number, steps = 25) {
    const fx = this.x;
    const fy = this.y;
    const dist = Math.hypot(x - fx, y - fy);
    const n = this.opts.fast ? 2 : dist < 30 ? 8 : steps;
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n);
      await this.page.mouse.move(fx + (x - fx) * k, fy + (y - fy) * k);
      if (!this.opts.fast) await sleep(16);
    }
    this.x = x;
    this.y = y;
  }

  /** Re-draws the cursor after a navigation (the overlay starts hidden on a new page). */
  async restoreCursor() {
    await this.page.mouse.move(this.x + 0.5, this.y);
    await this.page.mouse.move(this.x, this.y);
  }

  async moveToEl(loc: Locator) {
    await this.reveal(loc);
    const box = await loc.boundingBox();
    if (!box) throw new SceneFailure(`[${this.log.id}] no box for ${loc}`);
    await this.moveTo(box.x + box.width / 2, box.y + box.height / 2);
  }

  async click(loc: Locator, what?: string) {
    const el = loc.first();
    await this.see(el, what ?? String(loc));
    await this.moveToEl(el);
    await this.pause(140);
    await this.page.mouse.down();
    await sleep(70);
    await this.page.mouse.up();
    await this.pause(260);
  }

  /** Click something that navigates; the wait for the next page is logged as a cut. */
  async clickNav(loc: Locator, url: RegExp, what?: string) {
    await this.click(loc, what);
    const from = this.now();
    await this.page.waitForURL(url, { timeout: 15_000 }).catch(() => {
      throw new SceneFailure(`[${this.log.id}] expected to land on ${url} after clicking ${what ?? loc}`);
    });
    await this.settle("page load", from);
  }

  async type(text: string, reason = "typing") {
    const from = this.now();
    await this.page.keyboard.type(text, { delay: this.opts.fast ? 0 : 60 });
    const to = this.now();
    if (to - from > 1200) this.log.cuts.push({ from_ms: from, to_ms: to, action: "speed 2x", reason });
  }

  // ---------- scrolling ----------

  /** Smooth-scrolls the element into view only if it isn't comfortably visible. */
  async reveal(loc: Locator, block: ScrollLogicalPosition = "center") {
    const vh = this.page.viewportSize()!.height;
    const box = await loc.boundingBox();
    if (box && box.y >= 70 && box.y + box.height <= vh - 30) return;
    await this.scrollTo(loc, block);
  }

  async scrollTo(loc: Locator, block: ScrollLogicalPosition = "center") {
    const from = this.now();
    await loc.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b as ScrollLogicalPosition }), block);
    await this.waitScrollEnd(loc);
    if (this.now() - from > 2500) this.log.cuts.push({ from_ms: from, to_ms: this.now(), action: "speed 2x", reason: "long scroll" });
  }

  /** Smooth wheel scroll by dy CSS px under the current mouse position. */
  async wheel(dy: number) {
    const step = 40 * Math.sign(dy);
    const n = Math.ceil(Math.abs(dy) / 40);
    for (let i = 0; i < n; i++) {
      await this.page.mouse.wheel(0, step);
      if (!this.opts.fast) await sleep(18);
    }
    await this.pause(250);
  }

  private async waitScrollEnd(loc: Locator) {
    let last = -1;
    let still = 0;
    for (let i = 0; i < 80 && still < 3; i++) {
      await sleep(this.opts.fast ? 30 : 50);
      const y = (await loc.boundingBox())?.y ?? 0;
      still = Math.abs(y - last) < 0.5 ? still + 1 : 0;
      last = y;
    }
  }

  // ---------- edit marks ----------

  /** Logs a zoom on an element (box in video pixels at this moment), optional text, and holds for it. */
  async zoom(loc: Locator, z: ZoomOpts) {
    const el = loc.first();
    await this.see(el, z.name);
    await this.reveal(el);
    await this.pause(200);
    let b: Rect | null = z.fit === "text" ? await textBox(el) : await el.boundingBox();
    if (!b) throw new SceneFailure(`[${this.log.id}] no box for zoom ${z.name}`);
    for (const extra of z.to ? (Array.isArray(z.to) ? z.to : [z.to]) : []) {
      const t = z.fit === "text" ? await textBox(extra.first()) : await extra.first().boundingBox();
      if (t) b = union(b, t);
    }
    const pad = z.pad ?? 10;
    const vp = this.page.viewportSize()!;
    const x0 = Math.max(0, b.x - pad);
    const y0 = Math.max(0, b.y - pad);
    const x1 = Math.min(vp.width, b.x + b.width + pad);
    const y1 = Math.min(vp.height, b.y + b.height + pad);
    const d = this.opts.dpr;
    // The largest scale (up to the one asked for) at which the whole box still fits the frame.
    const fits = 0.95 * Math.min(vp.width / (x1 - x0), vp.height / (y1 - y0));
    const scale = Math.round(Math.max(1.1, Math.min(z.scale ?? 1.6, fits)) * 100) / 100;
    // Keep the cursor off the zoomed area.
    if (this.x >= x0 - 12 && this.x <= x1 + 12 && this.y >= y0 - 12 && this.y <= y1 + 12) {
      const below = y1 + 36;
      const above = y0 - 36;
      const right = x1 + 36;
      if (below < vp.height - 10) await this.moveTo(this.x, below);
      else if (above > 80) await this.moveTo(this.x, above);
      else if (right < vp.width - 10) await this.moveTo(right, this.y);
      else await this.moveTo(Math.max(10, x0 - 36), this.y);
    }
    const ms = z.ms ?? 3000;
    const at = this.now();
    this.log.zooms.push({
      at_ms: at,
      duration_ms: ms,
      element: { selector: z.selector ?? [loc, ...(z.to ? (Array.isArray(z.to) ? z.to : [z.to]) : [])].map(String).join(" + "), name: z.name },
      box: { x: Math.round(x0 * d), y: Math.round(y0 * d), w: Math.round((x1 - x0) * d), h: Math.round((y1 - y0) * d) },
      scale,
    });
    if (z.text) this.log.text.push({ at_ms: at, duration_ms: ms, text: z.text, subtitle: z.subtitle, position: z.position ?? "next to zoom" });
    await this.hold(ms, `zoom: ${z.name}`);
  }

  async text(text: string, opts: { ms?: number; position?: TextOverlay["position"]; subtitle?: string } = {}) {
    const ms = opts.ms ?? 3000;
    this.log.text.push({ at_ms: this.now(), duration_ms: ms, text, subtitle: opts.subtitle, position: opts.position ?? "top" });
    await this.hold(ms, `text: ${text}`);
  }

  note(s: string) {
    this.log.notes.push(s);
  }

  /** The scene's main-moment screenshot (thumbnail / fallback). */
  async shot(name = this.log.id) {
    fs.mkdirSync(this.opts.shotDir, { recursive: true });
    const file = path.join(this.opts.shotDir, `${name}.png`);
    await this.page.screenshot({ path: file });
    if (name === this.log.id) this.log.screenshot = path.relative(path.dirname(this.opts.shotDir), file);
  }

  // ---------- navigation ----------

  async goto(p: string) {
    const from = this.now();
    await this.page.goto(BASE + p);
    await this.settle("page load", from);
    await this.restoreCursor();
  }
}

// Renders the edit's graphics as PNGs with Chromium: text pills, title cards, the phone bezel.
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const FONT = `'Helvetica Neue', Helvetica, Arial, sans-serif`;

export type Png = { file: string; w: number; h: number };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function shoot(page: Page, html: string, file: string, size: { w: number; h: number }, transparent: boolean): Promise<Png> {
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:${transparent ? "transparent" : "#0f172a"};}
    *{box-sizing:border-box;-webkit-font-smoothing:antialiased;}
  </style></head><body>${html}</body></html>`);
  const el = page.locator("#shot");
  await el.screenshot({ path: file, omitBackground: transparent });
  const box = (await el.boundingBox())!;
  return { file, w: Math.round(box.width), h: Math.round(box.height) };
}

export class Assets {
  private constructor(private page: Page, private close: () => Promise<void>, private dir: string) {}

  static async open(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    const browser = await chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    return new Assets(page, () => browser.close(), dir);
  }

  /** White text on a dark pill (optional smaller subtitle line). */
  pill(name: string, text: string, subtitle?: string): Promise<Png> {
    const html = `<div id="shot" style="display:inline-block;padding:8px">
      <div style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;
        padding:${subtitle ? "22px 44px 22px" : "20px 44px"};border-radius:${subtitle ? 40 : 999}px;
        background:rgba(15,23,42,0.9);box-shadow:0 6px 24px rgba(0,0,0,0.28);
        font-family:${FONT};color:#fff;text-align:center;white-space:nowrap">
        <div style="font-size:44px;font-weight:600;letter-spacing:-0.2px;line-height:1.15">${esc(text)}</div>
        ${subtitle ? `<div style="font-size:28px;font-weight:400;opacity:0.82;line-height:1.2">${esc(subtitle)}</div>` : ""}
      </div></div>`;
    return shoot(this.page, html, path.join(this.dir, `${name}.png`), { w: 1920, h: 400 }, true);
  }

  /** A small step badge ("Step 1 of 8 · Capture"). */
  badge(name: string, text: string): Promise<Png> {
    const html = `<div id="shot" style="display:inline-block;padding:6px">
      <div style="display:inline-block;padding:12px 26px;border-radius:999px;background:#2563eb;
        box-shadow:0 4px 16px rgba(0,0,0,0.25);font-family:${FONT};color:#fff;font-size:30px;font-weight:600;white-space:nowrap">${esc(text)}</div></div>`;
    return shoot(this.page, html, path.join(this.dir, `${name}.png`), { w: 1920, h: 200 }, true);
  }

  /** A plain dark full-frame title card. */
  card(name: string, title: string, kicker?: string): Promise<Png> {
    const html = `<div id="shot" style="width:1920px;height:1080px;background:#0f172a;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:28px;font-family:${FONT};color:#fff;text-align:center">
        ${kicker ? `<div style="font-size:34px;font-weight:500;letter-spacing:4px;text-transform:uppercase;opacity:0.6;color:#cbd5e1">${esc(kicker)}</div>` : ""}
        <div style="font-size:92px;font-weight:650;letter-spacing:-1px">${esc(title)}</div>
      </div>`;
    return shoot(this.page, html, path.join(this.dir, `${name}.png`), { w: 1920, h: 1080 }, false);
  }

  /** A phone bezel with a transparent, rounded screen of exactly screen.w × screen.h. */
  bezel(name: string, screen: { w: number; h: number }, border = 16): Promise<Png> {
    const W = screen.w + border * 2;
    const H = screen.h + border * 2;
    const html = `<div id="shot" style="position:relative;width:${W}px;height:${H}px;border-radius:64px;overflow:hidden;
        box-shadow:inset 0 0 0 2px #3a3f4b">
        <div style="position:absolute;left:${border}px;top:${border}px;width:${screen.w}px;height:${screen.h}px;border-radius:50px;
          box-shadow:0 0 0 ${border + 40}px #0b0d12"></div>
        <div style="position:absolute;inset:0;border-radius:64px;box-shadow:inset 0 0 0 2px #3a3f4b"></div>
      </div>`;
    return shoot(this.page, html, path.join(this.dir, `${name}.png`), { w: W, h: H }, true);
  }

  done() {
    return this.close();
  }
}

// Records the Darb Bill Pay demo, scene by scene, with Playwright (Chromium, headed) and CDP screencast.
//
//   npm run demo:record                     dry run of every scene, then record both parts
//   npm run demo:record -- --dry-run        checks only (headless unless --headed)
//   npm run demo:record -- --scene=P1-4     retake one scene (earlier scenes are replayed through the API)
//   npm run demo:record -- --part=2         record one part
//   npm run demo:record -- --no-dry-run     skip the dry run before recording
//   npm run demo:record -- --plan-only      rewrite scenes.json and EDIT_PLAN.md from the recorded clips
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { api } from "./lib/api";
import { durationMs, joinClips, Screencast } from "./lib/capture";
import { BASE, DESKTOP, FPS, MOBILE, OUT, REC } from "./lib/config";
import { fastPart2, readScenes, withPartTimes, writeEditPlan, type ScenesFile } from "./lib/edit-plan";
import { Director, SceneFailure } from "./lib/human";
import { emptyLog, type SceneLog } from "./lib/log";
import { ensureServer } from "./lib/server";
import { part1 } from "./scenes/part1";
import { part2 } from "./scenes/part2";
import type { Scene } from "./scenes/types";

const OVERLAY = fs.readFileSync(path.join(__dirname, "lib", "overlay.js"), "utf8");
const ALL: Scene[] = [...part1, ...part2];
const arg = (name: string) => process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const argValue = (name: string) => arg(name)?.split("=")[1];

const opts = {
  dryOnly: !!arg("dry-run"),
  skipDry: !!arg("no-dry-run"),
  headed: !!arg("headed"),
  scene: argValue("scene"),
  part: argValue("part") ? (Number(argValue("part")) as 1 | 2) : undefined,
  keepFrames: !!arg("keep-frames"),
  planOnly: !!arg("plan-only"),
};

const CHROME_ARGS = [
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
  "--window-position=0,0",
  "--force-color-profile=srgb",
];

class Session {
  private contexts: Partial<Record<"desktop" | "mobile", { ctx: BrowserContext; page: Page }>> = {};
  constructor(private browser: Browser) {}

  async page(kind: "desktop" | "mobile"): Promise<Page> {
    const have = this.contexts[kind];
    if (have) return have.page;
    const base = kind === "desktop" ? { viewport: DESKTOP.viewport, deviceScaleFactor: DESKTOP.deviceScaleFactor } : MOBILE;
    const { video: _video, ...ctxOpts } = base as typeof MOBILE;
    const ctx = await this.browser.newContext({
      ...ctxOpts,
      locale: "en-US",
      timezoneId: "Asia/Riyadh",
      acceptDownloads: true,
      bypassCSP: true,
      colorScheme: "light",
    });
    await ctx.addInitScript({ content: `window.__DEMO_OVERLAY_OPTS = { mobile: ${kind === "mobile"} };\n${OVERLAY}` });
    const page = await ctx.newPage();
    this.contexts[kind] = { ctx, page };
    return page;
  }

  async close() {
    for (const c of Object.values(this.contexts)) await c?.ctx.close();
    this.contexts = {};
  }
}

type Snapshot = Record<string, string>;
async function snapshot(): Promise<Snapshot> {
  const snap: Snapshot = {};
  for (const q of ["", "?status=discarded"]) {
    const { rows } = await api.get(`/api/bills${q}`);
    for (const r of rows) snap[r.bill.id] = r.bill.status;
  }
  const { suppliers } = await api.get("/api/payees");
  for (const { supplier: p } of suppliers) snap[p.id] = `${p.iban}|${p.bankChanges.map((c: any) => c.status).join(",")}`;
  return snap;
}

async function runPart(session: Session, part: 1 | 2, mode: { dry: boolean; only?: string }): Promise<SceneLog[]> {
  const scenes = ALL.filter((s) => s.part === part);
  const onlyIdx = mode.only ? scenes.findIndex((s) => s.id === mode.only) : -1;
  console.log(`\n=== Part ${part} · ${mode.dry ? "dry run" : "recording"}${mode.only ? ` · ${mode.only}` : ""}`);
  await api.reset();
  const logs: SceneLog[] = [];
  let cursor = { x: 900, y: 460 };

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (onlyIdx >= 0 && i < onlyIdx) {
      await s.before?.();
      await s.apply();
      console.log(`  · ${s.id} replayed through the API`);
      continue;
    }
    if (onlyIdx >= 0 && i > onlyIdx) break;

    await s.before?.();
    await api.user(s.user);
    const page = await session.page(s.mobile ? "mobile" : "desktop");
    const size = s.mobile ? MOBILE.video : DESKTOP.video;
    const dpr = s.mobile ? MOBILE.deviceScaleFactor : DESKTOP.deviceScaleFactor;
    await page.context().clearCookies(); // English, whatever the previous scene switched to
    await page.goto(BASE + s.start);
    await page.waitForLoadState("networkidle").catch(() => {});
    // Start every clip at the top of the page (the browser restores the scroll of a page seen before).
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll("main, [data-scroll], .overflow-y-auto, .overflow-auto").forEach((el) => (el.scrollTop = 0));
    });
    await page.waitForTimeout(400);
    const start = s.mobile ? { x: 195, y: 600 } : cursor;
    await page.mouse.move(start.x + 1, start.y);
    await page.mouse.move(start.x, start.y);

    const log = emptyLog(s.id, s.part, s.title, `clips/${s.id}.mp4`, size);
    const d = new Director(page, log, { fast: mode.dry, dpr, shotDir: mode.dry ? OUT.dry : OUT.shots, mobile: s.mobile }, start);
    const cast = mode.dry ? null : new Screencast(page, path.join(OUT.frames, s.id), size);
    if (cast) await cast.start();
    d.t0 = cast ? cast.t0 : Date.now();
    const began = Date.now();
    try {
      await s.run(d);
      await d.hold(500, "tail");
    } catch (err) {
      fs.mkdirSync(OUT.dry, { recursive: true });
      const shot = path.join(OUT.dry, `FAIL-${s.id}.png`);
      await page.screenshot({ path: shot }).catch(() => {});
      if (cast) await cast.stop();
      const msg = err instanceof SceneFailure ? err.message : `[${s.id}] ${(err as Error).message}`;
      throw new SceneFailure(`${msg}\n    screenshot: ${path.relative(process.cwd(), shot)}`);
    }
    if (cast) {
      log.clip_end_ms = await cast.stop();
      const out = path.join(OUT.clips, `${s.id}.mp4`);
      fs.mkdirSync(OUT.clips, { recursive: true });
      await cast.encode(out);
      if (!opts.keepFrames) cast.cleanup();
      log.clip_end_ms = durationMs(out);
    } else {
      log.clip_end_ms = d.now();
    }
    if (!s.mobile) cursor = { x: d.x, y: d.y };
    logs.push(log);
    console.log(`  ✓ ${s.id} ${s.title} (${((Date.now() - began) / 1000).toFixed(1)} s)`);
  }

  // Dry run: the API replay used for retakes must reach the same state as the clicks did.
  if (mode.dry && !mode.only) {
    const viaUi = await snapshot();
    await api.reset();
    for (const s of scenes) {
      await s.before?.();
      await s.apply();
    }
    const viaApi = await snapshot();
    const diff = Object.keys({ ...viaUi, ...viaApi }).filter((k) => viaUi[k] !== viaApi[k]);
    if (diff.length) throw new SceneFailure(`[Part ${part}] API replay differs from the clicks: ${diff.map((k) => `${k}: ${viaUi[k]} vs ${viaApi[k]}`).join("; ")}`);
    console.log(`  ✓ API replay matches the clicked state (${Object.keys(viaUi).length} records)`);
  }
  return logs;
}

function assemble(newLogs: SceneLog[], join = true) {
  const prev = readScenes();
  const byId = new Map<string, SceneLog>((prev?.scenes ?? []).map((s) => [s.id, s]));
  for (const l of newLogs) byId.set(l.id, l);
  const scenes = ALL.map((s) => byId.get(s.id)).filter((s): s is SceneLog => !!s && fs.existsSync(path.join(REC, s.clip)));
  const parts: ScenesFile["parts"] = [];
  const out: SceneLog[] = [];
  for (const part of [1, 2] as const) {
    const logs = scenes.filter((s) => s.part === part);
    if (!logs.length) continue;
    const complete = ALL.filter((s) => s.part === part).every((s) => logs.some((l) => l.id === s.id));
    let off = 0;
    for (const l of logs) {
      l.part_start_ms = off;
      off += l.clip_end_ms;
      out.push(withPartTimes(fastPart2(l)));
    }
    const file = `part${part}.mp4`;
    if (complete) {
      if (join || !fs.existsSync(path.join(OUT.parts, file))) {
        console.log(`• Joining ${file}`);
        joinClips(logs.map((l) => path.join(REC, l.clip)), path.join(OUT.parts, file), DESKTOP.video);
      }
      parts.push({ part, file, duration_ms: durationMs(path.join(OUT.parts, file)), scenes: logs.map((l) => l.id) });
    }
  }
  const file: ScenesFile = {
    generated_at: new Date().toISOString(),
    capture: "CDP screencast (JPEG quality 100) → ffmpeg H.264, CRF 16, 30 fps",
    video: { desktop: "1920×1080 (1280×720 CSS viewport at 1.5x)", mobile: "1170×2532 (390×844 at 3x, iPhone user agent)", fps: FPS, codec: "H.264 High, yuv420p" },
    notes: [
      "All times are milliseconds. at_ms / from_ms are inside the scene clip; part_at_ms / part_from_ms are inside part1.mp4 or part2.mp4.",
      "Zoom boxes are in video pixels of the scene clip at that moment. In part2.mp4 the phone clip P2-3 is centred on a dark 1920×1080 canvas, so use clips/P2-3.mp4 inside a phone frame instead.",
      "The demo clock starts Thu 15 Oct 2026, 4:10 PM Riyadh, after the 3:58 PM SARIE cut-off; P1-7 moves it to Sun 18 Oct, 9:00 AM off camera.",
      "Scales below 1.5 are boxes too wide or tall to fit the frame at 1.5 (full-width banners, the invoice-beside-approval shot, the run table); use the scale given or crop the edges.",
      "User switches (P1-4 Noura → Faisal) and the clock jump (P1-7) happen through the demo API with a reload; the reload is marked as a cut and P1-4 carries the overlay \"Now: Faisal · approver\". P1-7's \"Sunday 18 Oct, 9:00 AM\" overlay explains the time jump.",
      "Seen on camera (app, not changed): the run summary card in P2-2 clips its \"Submit for approval\" button text at 1280 px and wraps \"Limits · Per payment\"; toasts (bottom right) briefly cover the right-hand column (P1-1 over Add supplier, P1-2, P1-4); the desktop approval panel (P1-6) doesn't repeat the amount, which sits in the page header above the fold when Approve is on screen; the payment confirmation (P1-7) is a plain narrow column on a blank page.",
    ],
    parts,
    scenes: out,
  };
  fs.writeFileSync(OUT.scenes, JSON.stringify(file, null, 2));
  writeEditPlan(file);
  return file;
}

async function main() {
  if (opts.planOnly) {
    const file = assemble([], false);
    for (const p of file.parts) console.log(`✓ ${p.file}: ${(p.duration_ms / 1000).toFixed(1)} s`);
    return;
  }
  const server = await ensureServer();
  const want = opts.scene ? ALL.find((s) => s.id === opts.scene) : undefined;
  if (opts.scene && !want) throw new Error(`Unknown scene ${opts.scene}. Scenes: ${ALL.map((s) => s.id).join(", ")}`);
  const parts: (1 | 2)[] = want ? [want.part] : opts.part ? [opts.part] : [1, 2];
  let browser: Browser | undefined;
  try {
    if (!opts.skipDry) {
      browser = await chromium.launch({ headless: !opts.headed, args: CHROME_ARGS });
      const session = new Session(browser);
      for (const p of parts) await runPart(session, p, { dry: true, only: want?.id });
      await session.close();
      await browser.close();
      browser = undefined;
      console.log("\n✓ Dry run passed");
      if (opts.dryOnly) return;
    }
    browser = await chromium.launch({ headless: false, args: CHROME_ARGS });
    const session = new Session(browser);
    const logs: SceneLog[] = [];
    for (const p of parts) logs.push(...(await runPart(session, p, { dry: false, only: want?.id })));
    await session.close();
    const file = assemble(logs);
    for (const p of file.parts) console.log(`✓ ${p.file}: ${(p.duration_ms / 1000).toFixed(1)} s`);
    console.log(`✓ Wrote ${path.relative(process.cwd(), OUT.scenes)} and ${path.relative(process.cwd(), OUT.editPlan)}`);
  } finally {
    await browser?.close();
    await api.reset().catch(() => {});
    server.stop();
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof SceneFailure ? err.message : err?.stack ?? err}`);
  process.exit(1);
});

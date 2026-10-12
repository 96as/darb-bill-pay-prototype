// Recording settings. Nothing here is used by the app.
import path from "node:path";

export const ROOT = path.resolve(__dirname, "..", "..");
export const REC = path.join(ROOT, "demo-recording");
export const OUT = {
  clips: path.join(REC, "clips"),
  parts: REC,
  shots: path.join(REC, "screenshots"),
  dry: path.join(REC, ".dry-run"),
  frames: path.join(REC, ".frames"),
  downloads: path.join(REC, ".downloads"),
  data: path.join(REC, ".data"),
  scenes: path.join(REC, "scenes.json"),
  editPlan: path.join(REC, "EDIT_PLAN.md"),
};

export const PORT = Number(process.env.DEMO_PORT ?? 3110);
export const BASE = process.env.DEMO_BASE ?? `http://localhost:${PORT}`;
export const DIST_DIR = ".next-rec";

/** Desktop: the app's 1280px layout at 1.5x pixel density, so the video is 1920×1080 with crisp text. */
export const DESKTOP = {
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1.5,
  video: { w: 1920, h: 1080 },
};

/** Mobile (P2-3): 390×844 at 3x, an iPhone 14-class phone. */
export const MOBILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  video: { w: 1170, h: 2532 },
};

export const FPS = 30;
export const FIXTURES = path.join(ROOT, "fixtures", "invoices");

// CDP screencast capture: JPEG frames at quality 100 with their timestamps, then ffmpeg turns the
// variable-rate frames into constant 30 fps H.264. Sharper than Playwright's recordVideo (VP8, ~1 Mbps).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { CDPSession, Page } from "playwright";
import { FPS } from "./config";

type Frame = { file: string; t: number; received: number };

export class Screencast {
  private cdp?: CDPSession;
  private frames: Frame[] = [];
  private n = 0;
  t0 = 0;
  t1 = 0;

  constructor(
    private page: Page,
    private dir: string,
    private size: { w: number; h: number },
  ) {}

  async start() {
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", (f) => {
      const file = path.join(this.dir, `${String(this.n++).padStart(6, "0")}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, "base64"));
      const received = Date.now();
      const ts = f.metadata.timestamp ? f.metadata.timestamp * 1000 : received;
      this.frames.push({ file, t: ts, received });
      this.cdp?.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    this.t0 = Date.now();
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 100,
      maxWidth: this.size.w,
      maxHeight: this.size.h,
      everyNthFrame: 1,
    });
    // Wait for the first frame so the clip never starts black.
    for (let i = 0; i < 100 && this.frames.length === 0; i++) await new Promise((r) => setTimeout(r, 20));
  }

  async stop() {
    this.t1 = Date.now();
    await this.cdp?.send("Page.stopScreencast").catch(() => {});
    await this.cdp?.detach().catch(() => {});
    return this.t1 - this.t0;
  }

  /**
   * Resamples the variable-rate frames to constant 30 fps (each output frame shows the latest captured
   * frame at that instant) and pipes them to ffmpeg. Frame times use Chrome's capture timestamps,
   * aligned to our clock by the smallest capture→receive delay, so the scene log's times match the video.
   */
  async encode(out: string) {
    if (this.frames.length === 0) throw new Error(`No frames captured for ${out}`);
    const offset = Math.min(...this.frames.map((f) => f.received - f.t));
    const frames = this.frames.map((f) => ({ ...f, t: f.t + offset })).sort((a, b) => a.t - b.t);
    const { w, h } = this.size;
    const ff = spawn(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "pipe:0",
        "-vf", `scale=${w}:${h}:flags=lanczos,format=yuv420p`,
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-r", String(FPS),
        "-movflags", "+faststart",
        out,
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    const done = new Promise<number>((resolve) => ff.on("close", (code) => resolve(code ?? 1)));
    const total = Math.max(1, Math.round(((this.t1 - this.t0) / 1000) * FPS));
    let i = 0;
    let buf = fs.readFileSync(frames[0].file);
    for (let k = 0; k < total; k++) {
      const at = this.t0 + (k * 1000) / FPS;
      let moved = false;
      while (i + 1 < frames.length && frames[i + 1].t <= at) {
        i++;
        moved = true;
      }
      if (moved) buf = fs.readFileSync(frames[i].file);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    }
    ff.stdin.end();
    if ((await done) !== 0) throw new Error(`ffmpeg failed for ${out}`);
  }

  cleanup() {
    fs.rmSync(this.dir, { recursive: true, force: true });
  }
}

export function durationMs(file: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return Math.round(parseFloat(r.stdout.trim()) * 1000);
}

/** Joins clips into one file. Clips of another size (the phone clip) are centred on a dark 1920×1080 canvas. */
export function joinClips(clips: string[], out: string, size: { w: number; h: number }) {
  const args = ["-y", "-loglevel", "error"];
  for (const c of clips) args.push("-i", c);
  const parts = clips.map(
    (_, i) =>
      `[${i}:v]scale=${size.w}:${size.h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${size.w}:${size.h}:(ow-iw)/2:(oh-ih)/2:color=0x111827,setsar=1,fps=${FPS},format=yuv420p[v${i}]`,
  );
  const filter = `${parts.join(";")};${clips.map((_, i) => `[v${i}]`).join("")}concat=n=${clips.length}:v=1:a=0[out]`;
  args.push("-filter_complex", filter, "-map", "[out]", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-movflags", "+faststart", out);
  const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg join failed for ${out}`);
}

// Renders the edited demo from scenes.json: zooms (eased 0.4 s in / out), text pills, cuts and 2x
// speed-ups, title cards, and the phone clip in a bezel, joined into one video.
//
//   npm run demo:edit                  render demo-recording/final/darb-bill-pay-demo.mp4
//   npm run demo:edit -- --scene=P1-4  re-render one scene, then re-join
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { OUT, REC } from "../lib/config";
import type { ScenesFile } from "../lib/edit-plan";
import type { SceneLog } from "../lib/log";
import { Assets, type Png } from "./assets";

const FPS = 30;
const W = 1920;
const H = 1080;
const UP = 2; // zoom on a 2x upscale so the pan never steps by a whole output pixel
const RAMP = 0.4;
const DIR = path.join(REC, "edit", ".work");
const FINAL = path.join(REC, "final");
const VIDEO = path.join(FINAL, "darb-bill-pay-demo.mp4");

const CARDS = {
  intro: { title: "Darb Bill Pay · the pilot loop", kicker: "Prototype demo", sec: 3.0 },
  part2: { title: "What launch adds", kicker: "Part 2", sec: 2.5 },
  outro: { title: "Pilot with invited clients · Q3 2027", kicker: "Darb Bill Pay", sec: 3.5 },
};

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

function ff(args: string[], what: string) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${what}`);
}

function probeMs(file: string) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return Math.round(parseFloat(r.stdout) * 1000);
}

const X264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-r", String(FPS)];

/** ffmpeg expression: 0 → 1 → 0 over [a, b] with smoothstep ramps of RAMP seconds. */
function envelope(a: number, b: number) {
  const p = `(between(it,${a},${b})*min(min((it-${a})/${RAMP},(${b}-it)/${RAMP}),1))`;
  return `(${p}*${p}*(3-2*${p}))`;
}

function zoomFilter(log: SceneLog) {
  if (!log.zooms.length) return "null";
  const iw = W * UP;
  const ih = H * UP;
  let z = "1";
  let cx = `${iw / 2}`;
  let cy = `${ih / 2}`;
  for (const zm of log.zooms) {
    const a = zm.at_ms / 1000;
    const b = (zm.at_ms + zm.duration_ms) / 1000;
    const e = envelope(a, b);
    const bx = (zm.box.x + zm.box.w / 2) * UP;
    const by = (zm.box.y + zm.box.h / 2) * UP;
    z += `+${e}*${(zm.scale - 1).toFixed(3)}`;
    cx += `+${e}*(${bx.toFixed(1)}-${iw / 2})`;
    cy += `+${e}*(${by.toFixed(1)}-${ih / 2})`;
  }
  const x = `max(0,min(iw-iw/zoom,(${cx})-iw/zoom/2))`;
  const y = `max(0,min(ih-ih/zoom,(${cy})-ih/zoom/2))`;
  return `scale=${iw}:${ih}:flags=lanczos,zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${W}x${H}:fps=${FPS}`;
}

type Seg = { from: number; to: number; speed: 0 | 1 | 2 };

/** The clip's timeline as kept / cut / 2x segments (a cut wins over a speed-up where they overlap). */
function segments(log: SceneLog): Seg[] {
  const end = log.clip_end_ms;
  const pts = new Set<number>([0, end]);
  for (const c of log.cuts) {
    pts.add(Math.max(0, Math.min(end, c.from_ms)));
    pts.add(Math.max(0, Math.min(end, c.to_ms)));
  }
  const sorted = [...pts].sort((a, b) => a - b);
  const segs: Seg[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    if (to - from < 1000 / FPS) continue;
    const mid = (from + to) / 2;
    const inCut = log.cuts.some((c) => c.action === "cut" && mid > c.from_ms && mid < c.to_ms);
    const inFast = log.cuts.some((c) => c.action === "speed 2x" && mid > c.from_ms && mid < c.to_ms);
    const speed: Seg["speed"] = inCut ? 0 : inFast ? 2 : 1;
    const last = segs[segs.length - 1];
    if (last && last.speed === speed && Math.abs(last.to - from) < 1) last.to = to;
    else segs.push({ from, to, speed });
  }
  return segs.filter((s) => s.speed !== 0);
}

async function renderScene(log: SceneLog, assets: Assets, bezel: Png | null, phone: { w: number; h: number }) {
  const out = path.join(DIR, `${log.id}.mp4`);
  const clip = path.join(REC, log.clip);
  const mobile = log.size.h > log.size.w;
  const inputs: string[] = ["-i", clip];
  const parts: string[] = [];
  let n = 1;
  let cur = "base";

  if (mobile) {
    const dur = log.clip_end_ms / 1000;
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(dur), "-i", bezel!.file);
    const bz = n++;
    parts.push(
      `color=c=0x0f172a:s=${W}x${H}:r=${FPS}:d=${dur}[bg]`,
      `[0:v]scale=${phone.w}:${phone.h}:flags=lanczos,setsar=1[ph]`,
      `[bg][ph]overlay=x=(W-w)/2:y=(H-h)/2:shortest=1[phbg]`,
      `[phbg][${bz}:v]overlay=x=(W-w)/2:y=(H-h)/2:shortest=1,format=yuv420p[${cur}]`,
    );
  } else {
    parts.push(`[0:v]${zoomFilter(log)},setsar=1,format=yuv420p[${cur}]`);
  }

  // Text pills, faded in and out, over the zoomed frame.
  for (let i = 0; i < log.text.length; i++) {
    const t = log.text[i];
    const png = await assets.pill(`${log.id}-text${i}`, t.text, t.subtitle);
    const dur = t.duration_ms / 1000;
    const at = t.at_ms / 1000;
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(dur), "-i", png.file);
    const k = n++;
    let x = `(W-w)/2`;
    let y = t.position === "top" ? "100" : `H-h-70`;
    if (mobile) {
      x = `${Math.round((W - phone.w) / 2 - 70)}-w`;
      y = `(H-h)/2`;
    }
    parts.push(
      `[${k}:v]format=rgba,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=${Math.max(0, dur - 0.25)}:d=0.25:alpha=1,setpts=PTS-STARTPTS+${at}/TB[p${i}]`,
      `[${cur}][p${i}]overlay=x=${x}:y=${y}:eof_action=pass:repeatlast=0[t${i}]`,
    );
    cur = `t${i}`;
  }

  // Cuts and 2x speed-ups.
  const segs = segments(log);
  parts.push(`[${cur}]split=${segs.length}${segs.map((_, i) => `[s${i}]`).join("")}`);
  segs.forEach((s, i) => {
    const f = s.speed === 2 ? 0.5 : 1;
    const fps = s.speed === 2 ? `,fps=${FPS}` : "";
    parts.push(`[s${i}]trim=start=${(s.from / 1000).toFixed(3)}:end=${(s.to / 1000).toFixed(3)},setpts=(PTS-STARTPTS)*${f}${fps}[g${i}]`);
  });
  parts.push(`${segs.map((_, i) => `[g${i}]`).join("")}concat=n=${segs.length}:v=1:a=0[out]`);
  const expected = segs.reduce((a, s) => a + (s.to - s.from) / s.speed, 0) / 1000;

  const script = path.join(DIR, `${log.id}.filter.txt`);
  fs.writeFileSync(script, parts.join(";\n"));
  ff([...inputs, "-/filter_complex", script, "-map", "[out]", "-t", expected.toFixed(3), ...X264, out], `scene ${log.id}`);
  return out;
}

function renderCard(png: Png, sec: number, name: string) {
  const out = path.join(DIR, `${name}.mp4`);
  ff(
    ["-loop", "1", "-framerate", String(FPS), "-t", String(sec), "-i", png.file,
      "-vf", `fade=t=in:st=0:d=0.4,fade=t=out:st=${sec - 0.4}:d=0.4,format=yuv420p`, ...X264, out],
    `card ${name}`,
  );
  return out;
}

const mmss = (ms: number) => {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};

async function main() {
  const scenesFile = JSON.parse(fs.readFileSync(OUT.scenes, "utf8")) as ScenesFile;
  const only = arg("scene");
  fs.mkdirSync(DIR, { recursive: true });
  fs.mkdirSync(FINAL, { recursive: true });
  const assets = await Assets.open(path.join(DIR, "assets"));
  try {
    const phone = { w: 444, h: 960 }; // 1170×2532 scaled to 960 px tall
    const bezel = await assets.bezel("bezel", phone);

    const order: { name: string; file: string; scene?: SceneLog }[] = [];
    const card = async (key: keyof typeof CARDS) => {
      const c = CARDS[key];
      const file = path.join(DIR, `card-${key}.mp4`);
      if (!only || !fs.existsSync(file)) renderCard(await assets.card(`card-${key}`, c.title, c.kicker), c.sec, `card-${key}`);
      order.push({ name: `Card: ${c.title}`, file });
    };

    await card("intro");
    for (const part of [1, 2] as const) {
      if (part === 2) await card("part2");
      for (const s of scenesFile.scenes.filter((x) => x.part === part)) {
        const file = path.join(DIR, `${s.id}.mp4`);
        if (!only || only === s.id || !fs.existsSync(file)) {
          console.log(`• ${s.id} ${s.title}`);
          await renderScene(s, assets, bezel, phone);
        }
        order.push({ name: `${s.id} · ${s.title}`, file, scene: s });
      }
    }
    await card("outro");

    console.log("• Joining");
    const list = path.join(DIR, "join.txt");
    fs.writeFileSync(list, order.map((o) => `file '${o.file}'`).join("\n"));
    ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", VIDEO], "join");

    // Where each scene lands in the final video (for the voice-over).
    let t = 0;
    const rows: string[] = [];
    for (const o of order) {
      const d = probeMs(o.file);
      const texts = o.scene?.text.map((x) => `"${x.text}"`).join(", ") ?? "";
      rows.push(`| ${mmss(t)} | ${mmss(t + d)} | ${(d / 1000).toFixed(1)} s | ${o.name} | ${texts} |`);
      t += d;
    }
    const total = probeMs(VIDEO);
    fs.writeFileSync(
      path.join(FINAL, "TIMELINE.md"),
      [
        "# Final video timeline",
        "",
        `\`darb-bill-pay-demo.mp4\` · 1920×1080 · 30 fps · H.264 · no audio · **${mmss(total)}**. Rendered from \`scenes.json\` by \`npm run demo:edit\`.`,
        "",
        "Use these times to place the voice-over and music in CapCut.",
        "",
        "| Start | End | Length | Segment | On-screen text |",
        "|---|---|---|---|---|",
        ...rows,
        "",
      ].join("\n"),
    );
    console.log(`✓ ${path.relative(process.cwd(), VIDEO)} (${mmss(total)})`);
  } finally {
    await assets.done();
  }
}

main().catch((err) => {
  console.error(`✗ ${err?.stack ?? err}`);
  process.exit(1);
});

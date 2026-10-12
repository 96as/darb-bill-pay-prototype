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

async function renderScene(log: SceneLog & { badge?: string }, assets: Assets, bezel: Png | null, phone: { w: number; h: number }) {
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

  // Step badge for the whole segment (bottom left, over the sidebar footer).
  if (log.badge) {
    const png = await assets.badge(`${log.id}-badge`, log.badge);
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(log.clip_end_ms / 1000), "-i", png.file);
    const k = n++;
    parts.push(`[${cur}][${k}:v]overlay=x=24:y=H-h-24:eof_action=pass:repeatlast=0[badge]`);
    cur = "badge";
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

type T = { at: number; ms: number; text: string; position?: "top" | "bottom" | "next to zoom" };
/** The edit decision list: which clip (and which part of it) plays where, with its texts and step badge. */
function buildEdl(scenes: SceneLog[]) {
  const by = (id: string) => scenes.find((s) => s.id === id)!;
  const seg = (src: string, id: string, part: 1 | 2, title: string, badge: string, text: T[], range?: [number, number]) => {
    const l = by(src);
    const cuts = l.cuts.filter((c) => !c.reason.startsWith("Part 2 pace"));
    if (range) {
      if (range[0] > 0) cuts.push({ from_ms: 0, to_ms: range[0], action: "cut", reason: "not used" });
      if (range[1] < l.clip_end_ms) cuts.push({ from_ms: range[1], to_ms: l.clip_end_ms, action: "cut", reason: "not used" });
    }
    return {
      ...l, id, part, title, badge, cuts,
      text: text.map((t) => ({ at_ms: t.at, duration_ms: t.ms, text: t.text, position: t.position ?? "next to zoom" })),
    } as SceneLog & { badge: string };
  };
  const arabic = by("P2-5").holds.find((h) => /Arabic view/.test(h.reason))!;
  return [
    seg("P1-1", "P1-1", 1, "Capture: e-invoice", "Step 1 of 8 · Capture", [
      { at: 300, ms: 2400, text: "Upload the supplier's invoice", position: "top" },
      { at: 8253, ms: 3000, text: "ZATCA e-invoice: fields read from its XML" },
      { at: 13055, ms: 3000, text: "Supplier, VAT and totals filled in. No typing." },
    ]),
    seg("P2-1", "P1-1b", 1, "Capture: photo by OCR", "Step 1 of 8 · Capture", [
      { at: 8200, ms: 2500, text: "No e-invoice? A photo is read by OCR" },
      { at: 11722, ms: 1500, text: "Unclear fields are flagged" },
      { at: 15149, ms: 1200, text: "You confirm them" },
    ], [6900, 16867]),
    seg("P1-2", "P1-2", 1, "Duplicate blocked", "Step 2 of 8 · Duplicate check", [
      { at: 1000, ms: 2200, text: "Same invoice uploaded again…", position: "top" },
      ...by("P1-2").zooms.map((z) => ({ at: z.at_ms, ms: z.duration_ms, text: "Duplicate caught. It can't be paid twice." })),
    ]),
    seg("P1-3", "P1-3", 1, "New supplier + name check", "Step 3 of 8 · Add supplier", [
      { at: 1000, ms: 2200, text: "Add the supplier, prefilled from the invoice", position: "top" },
      ...by("P1-3").zooms.map((z) => ({ at: z.at_ms, ms: z.duration_ms, text: "Bank confirms the account name" })),
    ]),
    seg("P1-4", "P1-4", 1, "IBAN-change lock", "Step 4 of 8 · Bank change lock", [
      { at: 1200, ms: 2200, text: "The supplier's IBAN is changed…", position: "top" },
      ...by("P1-4").text.map((t) => ({
        at: t.at_ms, ms: t.duration_ms,
        text: t.text.startsWith("IBAN changed") ? "Payments to this supplier pause" : t.text.startsWith("Now:") ? "A second person reviews: Faisal, approver" : "Confirm the name, then approve the change",
        position: t.position,
      })),
      { at: by("P1-4").zooms[2].at_ms, ms: 3000, text: "Logged: who requested, who approved" },
    ]),
    seg("P1-5", "P1-5", 1, "Submit and pay on a date", "Step 5 of 8 · Submit for approval", [
      { at: 3435, ms: 1400, text: "Pay from main balance or a subwallet", position: "top" },
      { at: 4853, ms: 3000, text: "Rail and arrival date shown before approval" },
      { at: 8170, ms: 3000, text: "Over SAR 20,000, after Thursday's cut-off → Sunday" },
    ]),
    seg("P1-6", "P1-6", 1, "Approve", "Step 6 of 8 · Approve", [
      { at: 3881, ms: 3000, text: "Approver sees the invoice beside the payment" },
      { at: 7107, ms: 3000, text: "Warned: bank details changed recently" },
      { at: 11250, ms: 2800, text: "Approve on web or in the app" },
      { at: 13805, ms: 1500, text: "Scheduled for Sunday" },
    ]),
    seg("P1-7", "P1-7", 1, "Paid + proof", "Step 7 of 8 · Paid + proof", [
      ...by("P1-7").text.map((t) => ({ at: t.at_ms, ms: t.duration_ms, text: t.text.startsWith("Sunday") ? "Sunday 9:00 AM: paid" : "Payment confirmation in Arabic and English", position: t.position })),
    ]),
    seg("P2-4", "P1-7b", 1, "Accounting sync", "Step 7 of 8 · Paid + proof", [
      { at: 12698, ms: 2500, text: "Synced to accounting, invoice attached" },
    ], [9900, 15700]),
    seg("P1-8", "P1-8", 1, "Bills view", "Step 8 of 8 · Bills view", [
      ...by("P1-8").zooms.map((z) => ({ at: z.at_ms, ms: z.duration_ms, text: "Everything owed, per supplier" })),
      { at: by("P1-8").clip_end_ms - 3000, ms: 2500, text: "Filter by status: overdue bills", position: "top" },
    ]),
    seg("P2-1", "P2-1", 2, "Email inbox", "Launch 1 of 4 · Email inbox", [
      { at: 2042, ms: 2200, text: "Launch · forward invoices to a bills inbox" },
      { at: 4318, ms: 1500, text: "Each attachment becomes a draft" },
    ], [0, 6300]),
    seg("P2-2", "P2-2", 2, "Payment run", "Launch 2 of 4 · Payment runs", [
      ...by("P2-2").zooms.map((z, i) => ({ at: z.at_ms, ms: z.duration_ms, text: i === 0 ? "Launch · many bills, each with its own rail" : "One total, one approval" })),
    ]),
    seg("P2-4", "P2-3", 2, "Supplier notice + payable", "Launch 3 of 4 · Notice + bill sync", [
      { at: 4288, ms: 2500, text: "Launch · supplier notified in Arabic + English" },
      { at: 7300, ms: 2600, text: "Launch · bill synced as a payable" },
    ], [0, 9900]),
    seg("P2-5", "P2-4", 2, "SADAD + Arabic", "Launch 4 of 4 · SADAD + Arabic", [
      ...by("P2-5").zooms.map((z) => ({ at: z.at_ms, ms: z.duration_ms, text: "Launch · SADAD bills in the same list" })),
      { at: arabic.at_ms, ms: arabic.duration_ms, text: "The whole app in Arabic, right to left" },
    ]),
  ];
}

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
    const edl = buildEdl(scenesFile.scenes);
    for (const part of [1, 2] as const) {
      if (part === 2) await card("part2");
      for (const s of edl.filter((x) => x.part === part)) {
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

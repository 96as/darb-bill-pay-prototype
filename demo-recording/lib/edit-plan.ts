// Writes scenes.json and EDIT_PLAN.md from the scene logs.
import fs from "node:fs";
import { OUT } from "./config";
import type { SceneLog } from "./log";

export type PartInfo = { part: 1 | 2; file: string; duration_ms: number; scenes: string[] };
export type ScenesFile = {
  generated_at: string;
  capture: string;
  video: { desktop: string; mobile: string; fps: number; codec: string };
  notes: string[];
  parts: PartInfo[];
  scenes: SceneLog[];
};

export function readScenes(): ScenesFile | null {
  try {
    return JSON.parse(fs.readFileSync(OUT.scenes, "utf8")) as ScenesFile;
  } catch {
    return null;
  }
}

/** Adds part-file times (part_at_ms / part_from_ms) next to every clip time. */
export function withPartTimes(log: SceneLog): SceneLog {
  const off = log.part_start_ms ?? 0;
  return {
    ...log,
    part_end_ms: off + log.clip_end_ms,
    holds: log.holds.map((h) => ({ ...h, part_at_ms: off + h.at_ms })),
    zooms: log.zooms.map((z) => ({ ...z, part_at_ms: off + z.at_ms })),
    text: log.text.map((t) => ({ ...t, part_at_ms: off + t.at_ms })),
    cuts: log.cuts.map((c) => ({ ...c, part_from_ms: off + c.from_ms, part_to_ms: off + c.to_ms })),
  } as SceneLog;
}

const mmss = (ms: number) => {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};

/**
 * Part 2 moves faster: everything outside the zoom / text holds (and the Arabic hold) plays at 2x.
 * Returns the scene's cuts with those speed-ups added (existing cuts stay as they are).
 */
export function fastPart2(log: SceneLog): SceneLog {
  if (log.part !== 2) return log;
  const keep = [
    ...log.zooms.map((z) => [z.at_ms, z.at_ms + z.duration_ms]),
    ...log.text.map((t) => [t.at_ms, t.at_ms + t.duration_ms]),
    ...log.holds.filter((h) => /Arabic view/.test(h.reason)).map((h) => [h.at_ms, h.at_ms + h.duration_ms]),
    ...log.cuts.filter((c) => c.action === "cut").map((c) => [c.from_ms, c.to_ms]),
  ].sort((x, y) => x[0] - y[0]);
  const cuts = log.cuts.filter((c) => c.action === "cut");
  let t = 0;
  const gap = (from: number, to: number) => {
    if (to - from > 300) cuts.push({ from_ms: Math.round(from), to_ms: Math.round(to), action: "speed 2x", reason: "Part 2 pace: no zoom or text here" });
  };
  for (const [from, to] of keep) {
    gap(t, from);
    t = Math.max(t, to);
  }
  gap(t, log.clip_end_ms);
  cuts.sort((x, y) => x.from_ms - y.from_ms);
  return { ...log, cuts };
}

/** Planned edited length: cuts removed, 2x sections halved. */
export function editedMs(log: SceneLog): number {
  let ms = log.clip_end_ms;
  for (const c of log.cuts) ms -= c.action === "cut" ? c.to_ms - c.from_ms : (c.to_ms - c.from_ms) / 2;
  return Math.max(0, Math.round(ms));
}

export function writeEditPlan(file: ScenesFile) {
  const out: string[] = [];
  out.push("# Edit plan: Darb Bill Pay demo", "");
  out.push(`Generated ${file.generated_at} from \`scenes.json\`. Capture: ${file.capture}.`, "");
  out.push("Times are inside each scene clip (`clips/<id>.mp4`); add the scene's start in the part file (shown per scene) for `part1.mp4` / `part2.mp4`.", "");
  out.push("**Edit rules:** zoom in over 0.4 s, hold, zoom out over 0.4 s; scale 1.5–1.8; one zoom at a time. Text: white on a dark pill, ≤ 8 words, 2.5–3.5 s. Cut page loads; long typing and scrolls at 2x. Part 2 moves faster: everything outside its zoom / text holds plays at 2x. Every Part 2 text starts with \"Launch ·\".", "");

  out.push("## Lengths", "", "| Part | Scenes | Raw | Planned after edits | Target |", "|---|---|---|---|---|");
  for (const p of file.parts) {
    const logs = file.scenes.filter((s) => s.part === p.part);
    const raw = logs.reduce((a, s) => a + s.clip_end_ms, 0);
    const edited = logs.reduce((a, s) => a + editedMs(s), 0);
    out.push(`| ${p.part} (\`${p.file}\`) | ${p.scenes.join(", ")} | ${mmss(raw)} | ${mmss(edited)} | ${p.part === 1 ? "2:00–2:30" : "0:45"} |`);
  }
  out.push("", "Cards made in CapCut (not recorded): intro \"Darb Bill Pay · the pilot loop\", Part 2 card \"What launch adds\", outro \"Pilot with invited clients · Q3 2027\".", "");

  for (const s of file.scenes) {
    out.push(`## ${s.id} · ${s.title}`, "");
    out.push(
      `Clip \`${s.clip}\` (${s.size.w}×${s.size.h}) · length ${mmss(s.clip_end_ms)} · in part ${s.part}: ${mmss(s.part_start_ms ?? 0)}–${mmss(s.part_end_ms ?? s.clip_end_ms)} · planned after edits ${mmss(editedMs(s))}${s.screenshot ? ` · thumbnail \`${s.screenshot}\`` : ""}`,
      "",
    );
    type Row = { at: number; what: string; zoom: string; text: string; cut: string };
    const rows: Row[] = [];
    for (const h of s.holds) {
      if (h.reason.startsWith("zoom:") || h.reason.startsWith("text:")) continue;
      rows.push({ at: h.at_ms, what: `Hold ${(h.duration_ms / 1000).toFixed(1)} s: ${h.reason}`, zoom: "", text: "", cut: "" });
    }
    for (const z of s.zooms) {
      const t = s.text.find((x) => x.at_ms === z.at_ms);
      rows.push({
        at: z.at_ms,
        what: `Hold ${(z.duration_ms / 1000).toFixed(1)} s`,
        zoom: `${z.element.name} ×${z.scale} · box ${z.box.x},${z.box.y} ${z.box.w}×${z.box.h}`,
        text: t ? `"${t.text}"${t.subtitle ? ` + subtitle "${t.subtitle}"` : ""} (${t.position})` : "",
        cut: "",
      });
    }
    for (const t of s.text) {
      if (s.zooms.some((z) => z.at_ms === t.at_ms)) continue;
      rows.push({ at: t.at_ms, what: `Hold ${(t.duration_ms / 1000).toFixed(1)} s`, zoom: "", text: `"${t.text}" (${t.position})`, cut: "" });
    }
    for (const c of s.cuts) {
      rows.push({ at: c.from_ms, what: c.reason, zoom: "", text: "", cut: `${c.action} ${mmss(c.from_ms)}–${mmss(c.to_ms)}` });
    }
    rows.sort((a, b) => a.at - b.at);
    out.push("| Time | What happens | Zoom | Text | Cut |", "|---|---|---|---|---|");
    for (const r of rows) out.push(`| ${mmss(r.at)} | ${r.what} | ${r.zoom} | ${r.text} | ${r.cut} |`);
    if (s.notes.length) out.push("", ...s.notes.map((n) => `- ${n}`));
    out.push("");
  }
  if (file.notes.length) out.push("## Notes", "", ...file.notes.map((n) => `- ${n}`), "");
  fs.writeFileSync(OUT.editPlan, out.join("\n"));
}

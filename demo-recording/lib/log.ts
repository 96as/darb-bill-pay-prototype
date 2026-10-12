// The scene log that scenes.json and EDIT_PLAN.md are written from.

export type Box = { x: number; y: number; w: number; h: number };
export type Hold = { at_ms: number; duration_ms: number; reason: string };
export type Zoom = {
  at_ms: number;
  duration_ms: number;
  element: { selector: string; name: string };
  box: Box;
  scale: number;
};
export type TextOverlay = {
  at_ms: number;
  duration_ms: number;
  text: string;
  subtitle?: string;
  position: "top" | "bottom" | "next to zoom";
};
export type Cut = { from_ms: number; to_ms: number; action: "cut" | "speed 2x"; reason: string };

export type SceneLog = {
  id: string;
  part: 1 | 2;
  title: string;
  clip: string;
  size: { w: number; h: number };
  clip_start_ms: number;
  clip_end_ms: number;
  part_start_ms?: number;
  part_end_ms?: number;
  holds: Hold[];
  zooms: Zoom[];
  text: TextOverlay[];
  cuts: Cut[];
  screenshot?: string;
  notes: string[];
};

export function emptyLog(id: string, part: 1 | 2, title: string, clip: string, size: { w: number; h: number }): SceneLog {
  return { id, part, title, clip, size, clip_start_ms: 0, clip_end_ms: 0, holds: [], zooms: [], text: [], cuts: [], notes: [] };
}

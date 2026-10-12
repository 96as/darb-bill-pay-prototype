import type { UserId } from "../lib/api";
import type { Director } from "../lib/human";

export type Scene = {
  id: string;
  part: 1 | 2;
  title: string;
  /** Acting user when the clip starts (set through the demo API, off camera). */
  user: UserId;
  /** Page the clip starts on (loaded before capture starts). */
  start: string;
  mobile?: boolean;
  /** Off-camera setup that always runs before this scene (clock jumps, API-only steps). */
  before?: () => Promise<void>;
  /** This scene's effect on the demo state, done through the API. Used to skip it when retaking a later scene. */
  apply: () => Promise<void>;
  /** The on-camera actions, with checks that fail fast in the dry run. */
  run: (d: Director) => Promise<void>;
};

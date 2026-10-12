# Demo recording (recording-only; no app code)

Records the Darb Bill Pay demo as scene clips plus an edit plan for CapCut.

```bash
npm run demo:record                      # dry run of every scene, then record Part 1 and Part 2
npm run demo:record -- --dry-run         # checks only (add --headed to watch)
npm run demo:record -- --scene=P1-4      # retake one scene; earlier scenes are replayed through the API
npm run demo:record -- --part=2          # one part
npm run demo:record -- --plan-only       # rewrite scenes.json + EDIT_PLAN.md from the clips
```

- **Server:** uses one already answering on `http://localhost:3110`, otherwise builds into `.next-rec` and starts `next start -p 3110` with its own data in `demo-recording/.data` (`DEMO_PORT` / `DEMO_BASE` override). It never touches `data/store.json`.
- **Capture:** Playwright Chromium, headed, 1280×720 CSS at 1.5x → **1920×1080**; P2-3 at 390×844 at 3x with an iPhone user agent → **1170×2532**. Frames come from the CDP screencast (JPEG quality 100), resampled to constant 30 fps and encoded with ffmpeg (H.264 High, CRF 16). Needs `ffmpeg` on the PATH.
- **On camera:** an injected cursor dot with a click ripple, 25-step eased mouse moves, 60 ms typing, smooth scrolling; the Demo button is hidden with injected CSS; user switches, resets and the clock jump go through the demo API.

| Output | What |
|---|---|
| `clips/<scene>.mp4` | One clip per scene |
| `part1.mp4`, `part2.mp4` | Each part joined (P2-3 is centred on a dark canvas there; use its own clip in a phone frame) |
| `scenes.json` | Holds, zooms (element + box in video px + scale), text, cuts / speed-ups, per scene, in clip and part time |
| `EDIT_PLAN.md` | The same as tables, with raw and planned lengths |
| `screenshots/` | One still per scene's main moment |

Files: `record.ts` (runner), `scenes/part1.ts`, `scenes/part2.ts` (the scenes, each with an API `apply` for retakes), `lib/` (capture, human-like input, overlay, log, edit plan, server, API).

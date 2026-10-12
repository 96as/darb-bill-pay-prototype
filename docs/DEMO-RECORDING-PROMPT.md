# Prompt for Claude Code: record the Bill Pay demo, with an edit plan for CapCut

**Before you run it:** start the app (`npm run dev`, http://localhost:3000), open Claude Code in the prototype folder, and paste the prompt below. It records clean video only. Add the voice-over or music later in CapCut.

```text
I need a recorded demo of the Bill Pay prototype for Darb's product lead, plus an edit plan that you (Claude Code) will use later to edit it in CapCut. Read DEMO.md, docs/PRD.md and the app before planning. Don't change app code; anything recording-only goes in a separate folder, demo-recording/.

## What the video must show
The PRD now pilots a smaller scope in Q3 2027 and adds the rest at launch. So the video has two parts:
- Part 1, "The pilot loop" (target 2:00 to 2:30 after editing): capture → check → approve → pay → prove, on the web.
- Part 2, "What launch adds" (target 0:45): the features that move to launch, each one labelled "Launch".
Use the users, invoices and amounts from DEMO.md. If a scene below doesn't match the app, follow the app and tell me what you changed.

## Scenes
Part 1: the pilot loop (desktop, 1920×1080)
- P1-1 Upload an e-invoice: upload the PDF/A-3 with ZATCA XML; the draft opens with fields read from the XML.
- P1-2 Duplicate blocked: upload the same invoice again; show the duplicate block.
- P1-3 New supplier + name check: add the supplier; show the name-check result.
- P1-4 IBAN-change lock: as the preparer, change the supplier's IBAN; show unsent payments paused. Switch to the approver: confirm the name match, approve the change. Show the "bank details changed on … requested by …, approved by …" line.
- P1-5 Submit and pay on a date: submit the bill; show rail and expected arrival before approval; show the bill over SAR 20,000 submitted after Thursday's cut-off arriving Sunday.
- P1-6 Approve on the web: as the approver, open the approval with the invoice beside the amount; approve through the confirm sheet ("Confirm and release").
- P1-7 Paid + proof: show the paid bill and the payment confirmation (Arabic and English).
- P1-8 Bills view: what is owed per supplier, with statuses and the Overdue filter.

Part 2: what launch adds
- P2-1 Email inbox + OCR: a forwarded phone photo becomes a draft that asks to check its fields.
- P2-2 Payment run: three bills in one run, one approval.
- P2-3 Approve in the app: record this scene at mobile size (390×844) as its own clip; I'll put it in a phone frame.
- P2-4 Supplier notice + accounting sync: what the supplier receives and what lands in the accounting system.
- P2-5 SADAD in the same list, then switch the app to Arabic for 3 seconds (right-to-left).

## How to record
- Use Playwright with Chromium, headed, viewport 1920×1080 (P2-3 at 390×844 with a mobile user agent). Record each scene as its own clip (P1-1.webm …), then also make one joined file per part. Convert to MP4 (H.264, 30 fps, high quality) with ffmpeg. If Playwright's recordVideo looks soft or blocky, switch to CDP screencast frames at quality 100 joined with ffmpeg, and tell me which you used.
- Make it look human:
  - inject a visible cursor (a dot that follows the mouse) and a short ripple on every click;
  - move the mouse in smooth steps (about 25 steps per move);
  - type at about 60 ms per character;
  - scroll smoothly, never jump.
- Pacing: after each meaningful change, hold still. Hold 1.5 s by default, and 3 s wherever the edit plan puts a zoom or a text overlay, so the editor has room. Note every hold in the scene log.
- Hide prototype-only controls during recording: switch users and reset through the demo API rather than the Demo panel, and hide the floating Demo button with injected CSS (recording only, no app change). Reset the demo before each part so retakes start the same.
- Keep the demo clock as DEMO.md sets it, so the cut-off scene works.
- First do a dry run with no recording that checks every scene's expected state (fail fast with a clear message). Then record.
- Make it re-runnable: `npm run demo:record`, plus `npm run demo:record -- --scene=P1-4` to retake one scene.

## The scene log (for editing)
For every scene write demo-recording/scenes.json with:
- id, part, title, clip file, start and end time (ms, inside the clip and inside the joined part file);
- holds: [{at_ms, duration_ms, reason}];
- zooms: [{at_ms, duration_ms, element (selector and plain name), box {x, y, w, h} in video pixels at that moment, scale}]. Take the box from the element's bounding box at that moment, scaled to the video;
- text: [{at_ms, duration_ms, text, position (top/bottom/next to zoom)}];
- cuts or speed-ups: [{from_ms, to_ms, action: "cut" or "speed 2x", reason}], for example long typing or page loads;
- a PNG screenshot at the main moment of each scene (for thumbnails and fallback).
Also write demo-recording/EDIT_PLAN.md: the same plan as a readable table per scene (time, what happens, zoom, text, cut), plus total length before and after edits.

## Edit plan: zooms and on-screen text
Keep each text short (8 words or fewer), white on a dark pill, about 2.5 to 3.5 s each. Use these unless the app shows something better:

| Scene | Zoom on | On-screen text |
|---|---|---|
| Intro card (CapCut) | — | "Darb Bill Pay · the pilot loop" |
| P1-1 | the "Read from e-invoice" banner and the filled fields | "Read from the invoice's ZATCA XML. No typing." |
| P1-2 | the duplicate block | "Same invoice twice? Blocked." |
| P1-3 | the name-check result | "Bank confirms the account name" + small subtitle "In the pilot, Darb ops checks this by hand" |
| P1-4 (preparer) | the paused-payments notice | "IBAN changed → unsent payments pause" |
| P1-4 (approver) | confirm match + approve buttons, then the audit line | "A second person must approve the change" |
| P1-5 | rail + expected arrival | "Rail and arrival date, before approval" |
| P1-5 (cut-off) | the Sunday arrival | "After Thursday's cut-off → arrives Sunday" |
| P1-6 | invoice beside the amount, the bank-change warning | "Approver sees the invoice, not just an amount" |
| P1-7 | the confirmation document | "Proof of payment, Arabic and English" |
| P1-8 | totals per supplier | "Everything owed, per supplier" |
| Part 2 card (CapCut) | — | "What launch adds" |
| P2-1 | the "check these fields" prompt | "Launch · email inbox + OCR" |
| P2-2 | the run total and one approval | "Launch · many bills, one approval" |
| P2-3 | (phone frame) | "Launch · approve from the app" |
| P2-4 | supplier notice and the accounting entry | "Launch · supplier notified, books updated" |
| P2-5 | the SADAD row, then the Arabic view | "Launch · SADAD bills in the same list" |
| Outro card (CapCut) | — | "Pilot with invited clients · Q3 2027" |

Rules for the edit:
- Zoom in over 0.4 s, hold, zoom out over 0.4 s; scale 1.5 to 1.8.
- One zoom at a time.
- Cut page loads and long typing (or speed them up 2x).
- Part 2 moves faster than Part 1.
- Mark every Part 2 text with "Launch ·".

## Done when
- Clips, the two joined MP4s, scenes.json, EDIT_PLAN.md and screenshots are in demo-recording/.
- Every scene in the dry run passed.
- You tell me the raw length, the planned edited length, and anything in the app that looked off on camera (layout jumps, cut-off text, slow loads).

Show me your plan first (files, how you'll record, anything in DEMO.md that differs from the scenes above), then wait for my go-ahead.
```

# Immersive Case Desk Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. The user approved the proposed direction with “делай”.

**Goal:** Present Case Desk as a pixel point-and-click detective game, with the office as the primary world.

**Architecture:** Keep React, the case engine and existing saves. Replace the marketing shell with a viewport-sized office, a title overlay and a dossier selector. Add compact HUD, client arrival, pause, opt-in sound and distinct physical-object dialog shells.

**Tech Stack:** Existing React / TypeScript / Vite / CSS; browser Web Audio for small original procedural effects.

**Spec:** User-approved proposal in this conversation: full-screen cabinet, game title menu, object interactions, client introduction, responsive reactions. Existing SPEC.md remains authoritative for investigation rules.

## Global Constraints
- Preserve both cases, three attempts, clues, scores, wallet and save compatibility.
- Partner owns assets. Reuse existing art and unchanged 480×270 layout coordinates.
- No actual payments or playable duels. Do not require native fullscreen.
- No desktop page scrolling during investigation; long records scroll inside their object window.
- Keep keyboard focus, native dialog Escape and a readable mobile toolbelt.

## Review Focus
- Long documents remain reachable at 375px and at short landscape heights.
- All required actions remain available without hover, audio or animation.
- Intro, pause and subscription overlays stop the clock; records/search do not.
- Reload/resume never resets a saved run, wallet, hints or attempts.
- Audio denial/unsupported browser must never interrupt gameplay.

## Tasks
- [x] Replace App marketing layout with office title screen and dossier selection; retain future-mode/pass dialogs.
- [x] Replace Desk exterior page with scene stage, HUD, compact tools, arrival dialog and pause controls; keep investigation logic.
- [x] Style paper folder, CRT archive, corkboard, verdict, phone and safe distinctly. Add hotspot feedback and opt-in effects.
- [x] Verify desktop/mobile layouts, intro/pause/keyboard, saved game and solved path in browser; run regression suite and production build.
- [x] Review the diff, document controls, capture preview, commit and push existing feature branch.

## Execution record
- Base: 9a1d77d, clean feature branch. Existing browser inspection reproduced page scrolling, marketing navigation and hidden mobile scene.
- Ruling: visual-only CSS/layout changes use browser checks rather than implementation-mirroring unit tests. Existing engine tests cover the unchanged investigation rules.
- Ruling: scale the interactive scene proportionally to the available viewport rather than only integer multiples; preserve original coordinates and pixelated rendering. This keeps the whole desk reachable without page scrolling.
- Fresh review found clipping at 667×375. Browser reproduced the last menu action below the viewport (476.5px); compact two-column title layout placed it at 282px, inside the 375px viewport. Short screens also support internal menu scrolling.
- Help opened from Pause now keeps the clock stopped. Browser observed 00:23 before and after reading help; subscription overlay similarly held 01:57. Initial client arrival held 00:00 until accepted.
- Full tutorial solved with both evidence records and all verdict components (965 points). A 375px long document remained 333px wide with 333px content, and its pin button was reachable by internal scrolling. Keyboard A, input typing and Escape behavior verified; sound toggle works without console errors.
- Final checks: 167/167 tests, both case validators, TypeScript, Vite production build and git diff whitespace checks passed. Review had no remaining material findings. Captured immersive-menu.png and immersive-desk.png.

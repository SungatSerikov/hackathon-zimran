# Fullscreen and tutorial guidance QA — 2026-11-14

The old FIELD NOTE card was rendered for every tutorial desk frame, including the final step. It also reserved an extra strip below the office. The note now has an explicit close/toggle, collapses as a step advances, and starts collapsed when resuming a run with progress. Its preference is kept separately from game saves.

The office background fills the viewport; sprites retain their proportions and hotspot coordinates in a centered composition. HUD and tools overlay the room. A shared fullscreen control in the menu and desk uses the browser API on the document root so native game dialogs remain visible.

Verified in Chrome:

- Fresh tutorial offers the first hint; its close button hides it. The toggle reopens it, and reading the first record advances the step and collapses the card.
- Reload → Continue resumes progress with no expanded FIELD NOTE.
- Enter fullscreen changes to Exit fullscreen; menu → case → briefing → desk retains the mode. The computer dialog opens normally within it.
- Exit button and native Escape return to the window; the control synchronizes and Escape does not also open Pause.
- Desktop 1470×779 and narrow 375×812: room stage covers the viewport; no horizontal overflow at 375px; hint controls and toolbelt are reachable.
- Existing localhost tab received the updated menu; its original evidence and saved investigation were preserved. Functional testing used a separate 127.0.0.1 save.
- 191 existing tests passed; case validators, TypeScript and Vite production build passed.

Screenshot: [fullscreen-desk.jpg](fullscreen-desk.jpg). It shows the viewport-filling layout; native fullscreen also hides browser chrome when entered from the active tab. Browsers may reject fullscreen from an inactive tab; the UI handles that rejection without blocking play.

# Active object sprites — 2026-11-14

Reproduced the bug in Chrome: opening the informant left the phone image at `/assets/scene/phone.png`. The alternate art existed, but Scene received no active-window state. The safe also used its open sprite whenever the balance was positive, independently of its window.

Desk now passes the active object to Scene. Available variants are selected from this state, with a base-sprite fallback. Each image remounts when its source changes so previous failed/loading state cannot suppress the new art. Menu scenes use idle objects; coffee remains driven by attempts.

Browser checks on main after integrating feat/playable-case-desk:

| Action | Open window | After closing |
| --- | --- | --- |
| Call informant | phone_ring.png | phone.png |
| Open case folder | folder_open.png | folder.png |
| Search archive | monitor_on.png | monitor.png |
| Open safe | safe_open.png | safe.png |

Checked repeated phone opening, return to the default sprite, Escape closing the safe, and reload/resume. Phone variant decoded successfully at 56×40. Opening the informant did not purchase a hint. Screenshot: [active-phone.jpg](active-phone.jpg).

191 existing tests and the production build (including case validation and TypeScript) passed on the integrated main branch. No game data, sprites or hitbox coordinates were changed.

# Case Desk

A browser detective game for Business Cup 2.0. Read a complaint, follow clues through a fictional records archive, pin evidence, and decide what really happened. English interface; no account required.

All cases take place in **Riverton**, the fictional city used throughout the menu, bureau, documents, and archive. Use this name for new case content and assets.

## Run locally

Use **Node.js 22.12+** and npm.

```bash
npm ci
npm run dev
```

Open the localhost URL printed by Vite. No environment variables are required to play both cases. If your computer's global npm cache is not writable, use `npm ci --cache /tmp/case-desk-npm-cache` instead of changing system permissions.

```bash
npm test          # engine, data, reducer, persistence and records tests
npm run validate  # schema, clue reachability and shortest solution paths
npm run build     # validation + TypeScript + production output in dist/
npm run preview   # preview the production build locally
```

## What works

- **The Double Charge:** guided tutorial, 6 documents, 3 characters.
- **The Missing Refund:** a complete investigation, 14 documents, 5 characters.
- A pixel-art office with a background that fills the window, title menu, dossier selection and client arrivals. The office remains visible on mobile, with a touch-friendly toolbelt at 375px.
- Physical-object interfaces: paper folder, CRT archive, corkboard, stamped verdict, safe and informant phone. Optional procedural sound effects and reduced-motion support.
- Search using clues from discovered records; exact normalized matches and one-character typo tolerance for longer keys. Hidden guesses do not unlock evidence.
- A records computer with a document reader beside search results. Click highlighted names/references in the visible record or type a query; open returned records without leaving the computer. Narrow screens use document/results tabs.
- Eight document types, unread markers, pin/unpin and an evidence board. Reopening unchanged search results is free; searches are checked again when new clues unlock more records.
- GUILTY/NOT_GUILTY stamp + responsible person + explanation + **two pinned supporting documents**.
- Three attempts. Each wrong conclusion adds 60 seconds and removes one coffee. Repeating the identical conclusion does not burn another attempt accidentally.
- Stopwatch, score breakdown, solution explanation, fresh attempts, best scores, progress saved per browser, daily play streak.
- A bureau safe starting at $100, case fees with speed/accuracy bonuses, 25% replay fees, and paid two-level informant hints ($40 and 50 points per call).
- Local leaderboard and duel-interest tracking. Optional Supabase enables shared records.
- A clearly labeled subscription preview. **No subscription purchase, notification subscription or multiplayer is implemented.**

The current repository specification takes precedence over the earlier one-attempt concept. Correctness requires all four answer components; incomplete submissions are not charged as attempts. The timer counts investigation time, including records and search. It pauses for the client introduction, pause/help menu, subscription preview, and after leaving the desk. A browser refresh resumes saved progress after choosing Continue.

## Game controls

Click the objects in the office or use the bottom toolbelt. **F** opens the folder, **A** the archive, **E** the evidence board, **H** the informant and **V** the verdict. Shortcuts are disabled while a dialog or input is active. **Escape** closes an object window; at the desk it opens Pause. “Show objects” marks clickable props. Tutorial hints have a close button and a “Tutorial hint” toggle; they collapse after advancing a step and stay collapsed when resuming an investigation. Hiding them no longer changes the size of the office. Audio starts off and can be enabled from the title screen or the speaker button; the preference is saved locally. The ⛶ button in the menu and desk enters browser fullscreen; click it again or press Escape to exit. A rejected fullscreen request leaves the game playable in the window.

Scores follow `max(0, 1000 - elapsedSeconds - 150*wrongAttempts - 5*extraSearches - 50*paidHints)`. `elapsedSeconds` includes the additional 60 seconds per wrong attempt. Failed cases score zero. The exact shortest path is calculated by the same search rules used by the game: 2 searches for the tutorial and 3 for the main case. A natural main-case walkthrough is 4 searches; we preserved the partner's accessible clue graph instead of inserting artificial steps.

## Artist workflow

The partner's original assets, prompts, scene editor and layout are included. The game reads **`src/scene/layout.json`** in its existing format (`base.w/h`, object `x/y/w/h/z`, `sprite`, `action`). The interactive scene scales proportionally to fit the available viewport, preserving all hotspot coordinates and pixelated image rendering. Phones retain the scene and provide larger task buttons below it.

1. Replace matching PNG files in `public/assets/scene/`, `public/assets/portraits/` or `public/assets/ui/`.
2. Keep filename, transparency, base size and existing case portrait references. Do not bake document text or interaction labels into art.
3. Adjust positions/sizes in `src/scene/layout.json` if the object composition changes.
4. Reload the running app; missing images use CSS placeholders. Restart Vite after adding new image filenames (the build scans available art), or if your filesystem does not deliver file-watch events. For such filesystems, run `CASE_DESK_POLL=1 npm run dev`.
5. `npm run build` includes all current assets in `dist/`.

```bash
npm run scene:preview   # partner's standalone art preview/editor
npm run placeholders   # regenerates placeholder PNGs; don't run over finished art
```

`preview` now previews the actual built game; the partner's original preview command is preserved as `scene:preview`. See `ASSETS.md`, `ASSET_PROMPTS.md` and `tools/README.md` for the art contract. UI text, timer, selections and documents stay in React. Current artwork is replaceable prototype art supplied by the partner.

## Case authoring

Cases live in `src/cases/tutorial.json` and `src/cases/main.json`; the registry is `src/cases/index.ts`. Start with `CASE_TEMPLATE.md` and the shape in `src/types.ts`.

- `gameDate` uses MM/DD/YYYY and drives the in-world calendar; the streak uses real local calendar dates.
- Put every searchable clue in visible document fields **and** its `text` index. Extra receipt text may use `body.body`.
- A search entry unlocks only after a key appears in the brief or a discovered document.
- `requiredEvidence` is a pool from which any two distinct entries are accepted. These cases intentionally contain exactly two conclusive entries, avoiding weak pairs that happen to mention the suspect.
- The validator rejects bad types, broken IDs, invalid dates, impossible solutions and less than 80% reachable documents. It reports unused search entries as warnings and finds the true shortest query sequence, including overlapping typo matches.
- Every document is reachable in both shipped cases. The case tests ensure that searchable text matches what the UI shows.

Walkthroughs and spoiler-heavy content notes are in `docs/CASE_WALKTHROUGHS.md`. We minimally strengthened the teammate's records to establish actual ownership and transaction/domain authorship, rather than treating a registered agent or a matching phone number as sufficient proof. All people, companies and stories are fictional; domains use `.example` and phone numbers use the reserved fictional range. This is entertainment, not financial or legal advice.

## Bureau cash and informant

The safe is the player's wallet; the cabinet is the premium archive. The phone offers a clue from the shortest remaining search path. The first paid call names a clue type and its source document; the second names the exact query. Re-reading an already paid hint and final “pin your evidence” guidance are free. Insufficient funds open the clearly unavailable pass/cash-pack preview; players can keep investigating without paying.

The local wallet key is `cd.wallet`. Fees follow SPEC §8.1: `100*difficulty`, +50% for finishing within the estimated time (otherwise +25% within1.5×), +$50 for no wrong answers. Later clears of the same case pay25%, preserving cents. A persistent run ID makes fee credit and hint receipts idempotent across reloads. Browser-local cash has no monetary value and is not protected against editing browser storage. The planned $500/$1.99 pack cannot be purchased.

## Optional shared leaderboard

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Copy `.env.example` to `.env.local`.
3. Supply `VITE_SUPABASE_URL` and **the public anon key**, never a service-role key.
4. Restart the dev server, or add the same variables to Vercel and redeploy.

The service uses Supabase's REST API with timeouts, bounded validation and RLS. Without credentials or when the service fails, the UI labels scores/counts as local. The interest button stores one interest registration per browser and does not collect an email address or promise notifications. Failed score uploads remain explicitly local even if the community leaderboard can still be read.

**Demo limits:** answers are in the client bundle; rankings are self-reported, not anti-cheat or rate-limited. Do not use them for prizes. Anonymous RLS permits validated public inserts. Stable IDs make retries idempotent, and disk/session merging prevents stale tabs overwriting local scores. Truly simultaneous separate tabs can still post duplicate online scores because there is no server-enforced run fingerprint. Browser storage can be cleared and is not cross-device sync. Live Supabase was not configured during development; offline and service-failure paths are tested.

## Deploy to Vercel

The app is a static Vite build. Import this repository/branch into Vercel, choose **Vite**, and use:

| Setting | Value |
| --- | --- |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node | 22.12+ |
| Required environment variables | None |

`vercel.json` already contains the framework/build/output settings. Disable deployment protection for the final judging link so it opens without login. Verify in an incognito browser. A production deployment is **not** created automatically by this repository or by running the local preview.

## Project map

- `src/engine/`: pure search, normalization, validation, verdict and scoring functions.
- `src/store/`: run reducer and attempt protection.
- `src/lib/`: safe persistence, streaks and optional record service.
- `src/components/`: replaceable scene, native dialogs, icons, document renderer.
- `src/screens/`: detective desk and results.
- `src/App.tsx`: menu, case list, subscription preview and future duel screen.
- `scripts/validate-cases.ts`: build-time case check.
- `supabase/schema.sql`: optional public tables and policies.

Browser QA covered both correct endings, wrong answers and three-attempt failure, local score submission, reload/resume, replay, duel-interest and pass previews, and readable mobile documents at 375px. No live payment or online matchmaking is represented as working.

### Verdict review

The stamps judge the **respondent** named on the claim: red **GUILTY** when
they owe the claimant, green **NOT GUILTY** otherwise. After a wrong answer,
an explicit review dialog shows remaining attempts, one lost coffee, +60 seconds,
and the additional 150-point deduction. The clock pauses until that dialog closes.
The third wrong answer ends the case with **CASE FAILED**. Existing saves with
APPROVED/DENIED stamps migrate without resetting run identity or paid hints.

## Credits

Music: "Jazz Improvisation (Looped)" by Alex McCulloch / Pro Sensory (CC0) — https://opengameart.org/content/jazz-improvisation-looped

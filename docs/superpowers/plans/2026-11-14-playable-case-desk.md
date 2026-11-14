# Case Desk Implementation Plan

> For agentic workers: execute scoped tasks against SPEC.md, with independent engine/content work and a fresh whole-project review.

**Goal:** Ship the complete two-case, single-player detective loop with replaceable pixel-art assets.
**Architecture:** A static React application, data-driven cases, pure search/validation/scoring functions, a persisted reducer, and optional Supabase records. Scene layout and image paths remain separate from logic.
**Tech Stack:** Vite, React, TypeScript, Tailwind, Vitest, optional Supabase. Vercel-ready static output.
**Spec:** `SPEC.md`, `ASSETS.md`, `CASE_TEMPLATE.md` supplied by the user.

## Global Constraints
- The newly supplied SPEC.md governs: three lives, APPROVED/DENIED plus culprit, method and two pinned clues.
- English UI and stories for US adults; no login. Mobile at 375px.
- One tutorial and one main case, premium and duels clearly marked unavailable.
- Partner owns finished artwork. Missing images must leave fully usable CSS placeholders.
- No secrets, actual payment collection, runtime AI, or simulated online opponents.
- Current fresh clone is isolated on `feat/playable-case-desk`; preserve original specification files.

## Review Focus
- Queries for unseen clues must not reveal hidden evidence; punctuation/phone and one-letter typos must work.
- Malformed case data must produce actionable errors, never crashes or a falsely passing build.
- Refresh, corrupt storage and blocked localStorage must preserve usability; terminal results cannot mutate.
- Repeated submits and duplicate evidence cannot bypass the three-attempt rules.
- Remote failures must use explicitly local scores/counts; placeholders and small screens remain navigable.

## Task 1: Engine and case validation
Files: `src/engine/{normalize,search,validate,score,verdict}.ts`, their tests, `scripts/validate-cases.ts`.
Interfaces: `src/types.ts`; `normalize(value, kind?)`, `searchCase(caseData, openedIds, query): SearchResult`, `validateCase(input: unknown): ValidationReport`, `calculateScore(input: ScoreInput): number`, `evaluateVerdict(caseData, accusation): boolean`.
- [x] Write and observe failing behavior tests for discovery gates, normalization, fuzzy search, invalid schema, exact shortest query path and scoring/accusation edge cases.
- [x] Implement pure functions, use the same discovery rules for gameplay and validator; validate at build.
- [x] Verify tests and generated case reports.

## Task 2: Two playable stories
Files: `src/cases/{tutorial,main}.json`, `src/cases/index.ts`, `docs/CASE_WALKTHROUGHS.md`.
- [x] Author tutorial with 3 characters, 5–7 documents and 2–3 search steps; explicitly teach search, pinning and verdict.
- [x] Integrate partner refund main case with 4–6 characters, 10–15 documents, 4–6 searches and 2 refuted false leads.
- [x] Keep all useful keys visible in document bodies and flat text; verify both through the engine and document walkthroughs.

## Task 3: Persisted game and record services
Files: `src/store/game.ts`, `src/lib/{storage,records}.ts`, tests, `supabase/schema.sql`, `.env.example`.
- [x] Test three invalid attempts, duplicate submission protection, success, resume, invalid storage, scoring penalties.
- [x] Implement reducer and defensive storage; optional public Supabase only, bounded nickname and scores, local fallback explicitly labeled.
- [x] Verify meaningful tests and include setup instructions.

## Task 4: Playable visual interface
Files: `src/main.tsx`, `src/App.tsx`, focused components, `src/styles.css`, `src/scene/layout.json`.
- [x] Build menu/cases, interactive 480×270 desk with replaceable art, accessible overlays, document renderers, search/history, board, accusation and results.
- [x] Add progressive tutorial, elapsed timer/penalties, calendar/streak, local ranking, honest paywall and duel interest page.
- [x] Implement responsive 375px mobile tabs, keyboard navigation, dialog focus and reduced motion.
- [x] Run both complete cases in a browser, failure path, reload/resume and mobile checks.

## Task 5: Delivery
- [x] Independent review, fix concrete correctness findings, full tests/validate/production build.
- [x] Write launch, asset contract, walkthrough, deployment and limitations in README.
- [x] Keep a running local preview. Commit the finished branch; publish a review branch/PR where connection allows; never merge to main without instruction.

## Implementation rulings
- Supplied repo spec replaces earlier conversation's one-attempt design. This is recorded to make the change visible.
- A stopwatch (not hard countdown) uses active wall-clock intervals; pause while leaving desk. Wrong answers add 60 seconds and cost 150 additional points per SPEC.
- Two example stories are supplied now so the product is playable before the partner's final content; JSON can be replaced.
- Static demo ships answers to the browser and cannot provide anti-cheat rankings; explicitly documented.

## Completion notes
- Pulled teammate commit d6968ff during implementation; their cases, art tools and layout superseded initial temporary content. The game uses their layout schema unchanged.
- Strengthened conclusive evidence and visible search text without changing the two stories. Main exact optimum is3 queries, with a4-query guided walkthrough; preserved the natural graph.
- Independent review fixed renderer-schema mismatches for dates/receipt notes and distinguished local score saving from online leaderboard reads.
- Browser checks: both solved outcomes,3-error failure, reload/resume, ranking, duel/pass,375px document width. The observed mobile grid overflow was reproduced and fixed.
- Production build is Vercel-ready. Live hosting and shared Supabase still require the team's hosting/project credentials.

## Teammate update 4ad4f15 — implemented extension
- Safe now holds bureau money; phone sells two-level contextual hints; separate cabinet opens planned premium archive.
- Start100; solve fees use speed+clean bonuses and repeat25%; idempotent run/hint receipts prevent reload duplication.
- Paid hints cost40 and50points. The shortest remaining path uses the engine's actual unlock rules.
- New phone/cabinet art remains the partner's task; CSS placeholders are visible and clickable without missing-file requests.
- Final verification: 167 tests passed, both case graphs validated, TypeScript and production build passed. Browser checks confirmed two paid hints, free guidance, insufficient funds, persistence, and a single $350 award after reopening the result ($370 final balance). The wallet also fits a 375px viewport; browser error log was empty.

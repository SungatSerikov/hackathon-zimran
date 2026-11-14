# Records Computer Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the in-game computer understandable without guessing a first query or repeatedly switching dialogs.

**Architecture:** A RecordsComputer component owns presentation and history selection; Desk still owns the saved run and searches. Pure helpers extract visible clues and reuse unchanged historical searches. DocumentView optionally renders searchable inline details.

**Tech Stack:** Existing React 19, TypeScript, Vite, Vitest and CSS; no new dependencies.

**Spec:** docs/superpowers/specs/2026-11-14-records-computer-design.md

## Global Constraints

- Use only visible fields of the current opened document for suggestions.
- Preserve manual search, discovery gating, score rules and saved runs.
- Keep the native modal and pixel office, with readable text and a 375px layout.
- Update the existing feature branch and PR; do not merge into main.

## Review Focus

- Hidden aliases or unused body fields must never appear as suggestions.
- Source spelling/phone punctuation must remain searchable and readable.
- Overlapping names and domains must not corrupt rendered document text.
- A failed query that becomes available must not be trapped in stale history.
- Source switching, result opening and mobile tabs must retain sensible focus and scroll position.

### Task 1: Visible clues and history

Files: src/engine/search.ts, src/engine/clues.ts, src/engine/clues.test.ts.

- [x] Write tests for source-only leads, aliases, phone/order/domain spans, word boundaries, overlap handling and historical result reuse/unlocking.
- [x] Run focused tests and observe failure before implementation.
- [x] Export findClueMatches(text, key, kind), retaining existing discovery semantics; add getDocumentClues and findReusableSearch helpers.
- [x] Run focused tests plus existing search/case tests. Expected: all pass.

### Task 2: Workstation UI

Files: src/components/RecordsComputer.tsx, src/components/ClueText.tsx, src/components/DocumentView.tsx, src/screens/Desk.tsx, src/computer.css, src/main.tsx.

- [x] Add optional searchable text rendering to DocumentView without changing ordinary folder rendering.
- [x] Build document selector/reader, visible lead buttons, search/results, history and narrow-screen tabs.
- [x] Replace the old terminal block in Desk; update tutorial/help wording and keep informant query prefill working.
- [x] Run npm test and npm run build. Expected: tests, cases, TypeScript and production build pass.

### Task 3: Verify and deliver

- [x] Browser: new tutorial → source clue → result → next clue → pinned records; manual no-match, Enter, history reuse, source switch, close/reopen.
- [x] Check desktop and 375px layouts, keyboard highlights and console errors; save screenshots and concise QA notes.
- [ ] Independent final review, address meaningful findings, commit and push to existing PR, verify CI.

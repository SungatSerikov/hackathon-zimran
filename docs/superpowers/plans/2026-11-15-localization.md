# English / Russian Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Switch the whole playable demo between English and Russian without losing progress.
**Architecture:** React language context and bilingual UI strings; localized case copies share all IDs and merged search aliases. Language is presentation state independent of GameRun.
**Tech Stack:** Existing React, TypeScript, Vite, Vitest; locally bundled Cyrillic font.
**Spec:** `docs/superpowers/specs/2026-11-15-localization-design.md`

## Global Constraints
- Default English; `Language = "en" | "ru"`; persist via `case-desk:language`.
- Preserve case, document, search-entry, method, character and run IDs and all scoring rules.
- No runtime translation network calls; keep exact identifying numbers, URLs, and brand names.

## Review Focus
- A Russian visible clue must reveal the same records as its English equivalent.
- Switching with an active investigation must retain elapsed time, pins, attempts and selected verdict.
- Unsupported or blocked storage must fall back safely to English.
- Stored hints and queries from English must remain usable in Russian.
- Cyrillic labels must fit mobile controls and render without missing glyphs.

### Task 1: Language state and entry points
Files: `src/i18n/language.ts`, `src/i18n/I18n.tsx`, `src/components/LanguageSwitcher.tsx`, `src/App.tsx`, `src/screens/GameMenu.tsx`, `src/main.tsx`, styles.
Interface: `useI18n(): { language, setLanguage, locale, t(en: string, ru: string): string }`.
- [x] Test unsupported/blocked storage and persistence, implement context and selector.
- [x] Translate app/menu and add local Cyrillic font; supply current localized case by stable ID.

### Task 2: Case content
Files: `src/cases/ru/*.json`, `src/cases/localized.ts`, localized case tests.
Interface: `getLocalizedCases(language: Language): CaseData[]`, `getLocalizedCase(id: string, language: Language): CaseData | undefined`.
- [x] Translate both cases, regenerating text from visible fields and adding Russian search keys.
- [x] Test validation, complete reachability, solution parity, visible Russian searches, bilingual query equivalence, and cross-language saved progress.

### Task 3: Investigation screens
Files: `src/screens/Desk.tsx`, `src/screens/Result.tsx`.
- [x] Translate guidance, dialogs, verdicts, feedback, score and leaderboard UI with `useI18n`.
- [x] Insert `LanguageSwitcher` in the desk HUD; preserve state and physical hotkeys.

### Task 4: Archive and documents
Files: RecordsComputer, RecordPicker, DocumentView, ClueText.
- [x] Translate labels, metadata, controls, empty/error states; preserve exported English `docLabels` compatibility and translate them at display sites.
- [x] Verify archive search, records, and verdict evidence selection in both languages.

### Task 5: Scene, economy and shared controls
Files: Scene, Dialog, FullscreenButton, EconomyPanel, hint presentation helpers.
- [x] Translate scene labels, calendars, balance, history and saved/generated hints with safe English defaults.
- [x] Keep hint costs and step IDs unchanged; test language changes do not charge again.

### Verification
- [x] Run `npm test`, `npm run build`, and `git diff --check`.
- [x] Browser: toggle EN/RU on menu and active case, read Russian documents and search a Russian clue, reload, inspect narrow viewport and screenshot.
- [x] Review changes and push main.

## Verification evidence
- 225 tests passed across 18 files; production build, TypeScript and diff check passed.
- Build validation now checks English and Russian copies: 6 and 14 reachable documents, minimum 2 and 3 searches.
- Browser checked EN/RU menu, desk and result; reload retains Russian. Timer, attempts, cash, pinned evidence and selected verdict survive switching.
- Russian archive clue reused an English search without an extra search; tutorial completed successfully in Russian. Main-case introduction and informant checked.
- 375px menu, desk HUD and archive inspected with pixel Cyrillic; viewport restored. Screenshot: `docs/qa/russian-localization.jpg`.

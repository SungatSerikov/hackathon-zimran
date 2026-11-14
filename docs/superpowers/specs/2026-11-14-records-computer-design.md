# Records computer redesign

The user cannot tell what to search or how to use the existing empty terminal. The redesign must make the first action visible, keep reading and searching together, and retain the pixel detective atmosphere.

## Approach

Use a two-pane records workstation: a readable source document and search results, with a persistent search bar. Highlight searchable names/numbers in the currently displayed document and repeat those details as labelled shortcuts. Clicking a detail searches it; opening a result replaces the source document inside the same workstation. On narrow screens, explicit Document / Results tabs switch panes after each action.

Copy-only tips would leave the document-switching problem. A category-based database would add screens and change the authored search mechanics. The combined reader/search is the implementation choice for this requested redesign.

## Constraints

- Keep React, TypeScript, native dialogs, existing cases, game economy and scoring.
- Suggestions come only from visible fields of the current opened document; never from hidden search aliases, unseen documents or the solution.
- Keep manual typing, Enter submission and source punctuation. No automatic solution, evidence selection or verdict.
- Reopening an unchanged previous result is free; an old failed query must search again when a new clue unlocks it.
- Clear initial, found, already-filed and no-results states. Pin/read/result controls stay inside the computer.
- High-contrast text; keyboard-operable highlights, labels and mobile tabs; no horizontal overflow at 375px.
- Existing PR #1 is the delivery branch; no new dependencies or production deployment.

## Acceptance

A new player opens the computer, sees a document and an actionable example, clicks a clue, reads a result in the same window and follows its next clue. Search history works without spending searches; both case paths and previous verdict feedback remain functional.

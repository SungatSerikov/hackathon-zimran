# English and Russian

Add an English / Русский switch in the menu and desk. English stays the default for the US hackathon audience. Persist the choice in browser storage; changing language must not reset the active case, timer, evidence, money, or verdict selection.

Translate all player-facing UI, both case stories/documents/solutions, tutorial guidance, errors, and hints. Use Cyrillic-capable typography. Keep company brands, URLs, document IDs, dates, money, and solution IDs stable. The fictional city is Riverton (Ривертон in Russian).

Use a small React language context with inline bilingual UI copy and complete Russian case data. Merge English and Russian search aliases for the same entry; keep clue discovery gated by the currently readable documents. This preserves old queries and makes Russian clues searchable without changing the engine's rules. Saved hints should display in the current language.

No machine-translation requests at runtime and no account required. Work on main and push, following the established workflow.

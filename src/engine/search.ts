import type { CaseData, SearchEntry, SearchKind, SearchResult } from "../types";
import { normalize } from "./normalize";

const isWord = (value: string | undefined) =>
  value !== undefined && /[\p{L}\p{N}]/u.test(value);
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A clue must occur as a complete name/token, never as “Ann” inside “annual”. */
export function findClueMatches(
  text: string,
  key: string,
  kind: SearchKind,
): { start: number; end: number }[] {
  const needle = normalize(key, kind);
  if (!needle) return [];
  // Preserve source boundaries while ignoring the same punctuation as normalize.
  // This keeps a domain discoverable after “support@” and avoids concatenating
  // unrelated numbers or treating short keys as parts of longer words.
  const separator =
    kind === "phone"
      ? "[\\s().+\\-]*"
      : kind === "order"
        ? "[^\\p{L}\\p{N}]*"
        : "[^\\p{L}\\p{N}\\s]*";
  const expression = new RegExp(
    [...needle]
      .map((character) => (character === " " ? "\\s+" : escapeRegex(character)))
      .join(separator),
    "gu",
  );
  const lowered = text.toLowerCase();
  const matches: { start: number; end: number }[] = [];
  for (const match of lowered.matchAll(expression)) {
    const start = match.index;
    const end = start + match[0].length;
    if (isWord(lowered[start - 1]) || isWord(lowered[end])) continue;
    if (
      kind === "phone" &&
      (/\d[\s().+\-]*$/.test(lowered.slice(0, start)) ||
        /^[\s().+\-]*\d/.test(lowered.slice(end)))
    )
      continue;
    matches.push({
      start: kind === "phone" && lowered[start - 1] === "(" ? start - 1 : start,
      end,
    });
  }
  return matches;
}

export function clueOccurs(text: string, key: string, kind: SearchKind): boolean {
  return findClueMatches(text, key, kind).length > 0;
}

export function isEntryAvailable(
  caseData: CaseData,
  openedIds: ReadonlySet<string>,
  entry: SearchEntry,
): boolean {
  const visibleText = [
    caseData.brief,
    ...caseData.documents
      .filter((document) => openedIds.has(document.id))
      .map((document) => document.text),
  ];
  return entry.keys.some((key) =>
    visibleText.some((text) => clueOccurs(text, key, entry.kind)),
  );
}

/** The bounded Levenshtein check allows one insert, delete, or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

export function entryMatchesQuery(entry: SearchEntry, query: string): boolean {
  const normalizedQuery = normalize(query, entry.kind);
  if (!normalizedQuery) return false;
  return entry.keys.some((key) => {
    const normalizedKey = normalize(key, entry.kind);
    return (
      normalizedKey === normalizedQuery ||
      (normalizedKey.length >= 6 &&
        withinOneEdit(normalizedKey, normalizedQuery))
    );
  });
}

export function searchCase(
  caseData: CaseData,
  openedIds: string[],
  query: string,
): SearchResult {
  const opened = new Set(openedIds);
  const matched = caseData.searchIndex.filter(
    (entry) =>
      entryMatchesQuery(entry, query) &&
      isEntryAvailable(caseData, opened, entry),
  );
  const documentIds = [...new Set(matched.flatMap((entry) => entry.reveals))];
  return {
    documentIds,
    newDocumentIds: documentIds.filter((id) => !opened.has(id)),
    matchedEntryIds: matched.map((entry) => entry.id),
  };
}

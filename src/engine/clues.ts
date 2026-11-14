import type { CaseData, CaseDocument, SearchEntry, SearchKind } from "../types";
import { entryMatchesQuery, findClueMatches, searchCase } from "./search";
import { normalize } from "./normalize";

export interface DocumentClue {
  entryId: string;
  kind: SearchKind;
  query: string;
}

/** Match only fields that DocumentView renders, never its hidden search text. */
function readableFields(doc: CaseDocument): string[] {
  const b = doc.body;
  const fields: (string | undefined)[] = [doc.title];
  switch (doc.type) {
    case "receipt":
      fields.push(b.vendor, b.number, b.date, b.paymentMethod, b.body,
        ...(b.items?.map(item => item.name) ?? []));
      break;
    case "contract":
      fields.push(b.date, ...(b.parties ?? []), ...(b.clauses ?? []));
      break;
    case "chat":
      fields.push(...(b.participants ?? []),
        ...(b.messages?.flatMap(message => [message.from, message.time, message.text]) ?? []));
      break;
    case "email":
      fields.push(b.from, b.to, b.date, b.subject, b.body);
      break;
    case "ad":
      fields.push(b.headline, b.body, b.phone, b.address);
      break;
    case "bank_statement":
      fields.push(b.owner, ...(b.rows?.flatMap(row => [row.date, row.description]) ?? []));
      break;
    case "note":
    case "record":
      fields.push(b.heading, b.body);
      break;
  }
  return fields.filter((field): field is string => typeof field === "string");
}

export function getDocumentClues(doc: CaseDocument, index: SearchEntry[]): DocumentClue[] {
  const fields = readableFields(doc);
  const seen = new Set<string>();
  const clues: DocumentClue[] = [];
  for (const entry of index) {
    // Prefer the full printed name over an abbreviated alias.
    const candidates = [...entry.keys].sort((a, b) => b.length - a.length);
    let query: string | undefined;
    for (const key of candidates) {
      for (const field of fields) {
        const match = findClueMatches(field, key, entry.kind)[0];
        if (match) {
          query = field.slice(match.start, match.end);
          break;
        }
      }
      if (query) break;
    }
    if (!query) continue;
    const fingerprint = `${entry.kind}:${normalize(query, entry.kind)}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    clues.push({ entryId: entry.id, kind: entry.kind, query });
  }
  return clues;
}

export function splitClueText(
  text: string,
  clues: DocumentClue[],
): { text: string; clue?: DocumentClue }[] {
  const matches = clues.flatMap(clue =>
    findClueMatches(text, clue.query, clue.kind).map(range => ({ ...range, clue })),
  ).sort((a, b) => a.start - b.start || b.end - a.end);
  const parts: { text: string; clue?: DocumentClue }[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) parts.push({ text: text.slice(cursor, match.start) });
    parts.push({ text: text.slice(match.start, match.end), clue: match.clue });
    cursor = match.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function findReusableSearch(
  data: CaseData,
  openedIds: string[],
  history: { query: string; documentIds: string[] }[],
  query: string,
): number {
  if (!normalize(query)) return -1;
  const current = searchCase(data, openedIds, query).documentIds;
  for (let i = history.length - 1; i >= 0; i--) {
    const prior = history[i];
    const equivalent = normalize(prior.query) === normalize(query) ||
      data.searchIndex.some(entry =>
        entryMatchesQuery(entry, prior.query) && entryMatchesQuery(entry, query),
      );
    if (equivalent && prior.documentIds.length === current.length &&
      prior.documentIds.every(id => current.includes(id))) return i;
  }
  return -1;
}

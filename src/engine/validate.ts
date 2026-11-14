import type { CaseData, SearchKind, ValidationReport } from "../types";
import { normalize } from "./normalize";
import { entryMatchesQuery, isEntryAvailable } from "./search";

type ObjectValue = Record<string, unknown>;
const documentTypes = [
  "receipt",
  "contract",
  "chat",
  "email",
  "ad",
  "bank_statement",
  "note",
  "record",
];
const searchKinds = [
  "name",
  "company",
  "phone",
  "address",
  "order",
  "email",
  "plate",
  "other",
];

/** Validate untrusted JSON before any engine code consumes its nested fields. */
function schemaErrors(input: unknown): string[] {
  const errors: string[] = [];
  const object = (value: unknown, path: string): ObjectValue => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${path}: expected an object.`);
      return {};
    }
    return value as ObjectValue;
  };
  const string = (value: unknown, path: string): value is string => {
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`${path}: expected a non-empty string.`);
      return false;
    }
    return true;
  };
  const calendarDate = (value: unknown, path: string) => {
    if (!string(value, path)) return;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (match) {
      const [, monthText, dayText, yearText] = match;
      const month = Number(monthText);
      const day = Number(dayText);
      const year = Number(yearText);
      const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const daysInMonth = [
        31,
        leapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
      ];
      if (
        year > 0 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= daysInMonth[month - 1]
      )
        return;
    }
    errors.push(`${path}: expected a real calendar date in MM/DD/YYYY format.`);
  };
  const number = (value: unknown, path: string): value is number => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`${path}: expected a finite number.`);
      return false;
    }
    return true;
  };
  const boolean = (value: unknown, path: string) => {
    if (typeof value !== "boolean") errors.push(`${path}: expected a boolean.`);
  };
  const array = (value: unknown, path: string, min = 0): unknown[] => {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected an array.`);
      return [];
    }
    if (value.length < min)
      errors.push(`${path}: expected at least ${min} items.`);
    return value;
  };
  const strings = (value: unknown, path: string, min = 1): string[] =>
    array(value, path, min).filter((item, i): item is string =>
      string(item, `${path}[${i}]`),
    );
  const enumeration = (value: unknown, path: string, choices: string[]) => {
    if (typeof value !== "string" || !choices.includes(value))
      errors.push(`${path}: expected one of ${choices.join(", ")}.`);
  };
  const uniqueId = (value: unknown, path: string, seen: Set<string>) => {
    if (!string(value, path)) return;
    if (seen.has(value)) errors.push(`${path}: duplicate id “${value}”.`);
    seen.add(value);
  };
  const references = (ids: string[], path: string, known: Set<string>) => {
    ids.forEach((id) => {
      if (!known.has(id)) errors.push(`${path}: unknown id “${id}”.`);
    });
  };
  const checkBody = (type: unknown, bodyInput: unknown, path: string) => {
    const body = object(bodyInput, path);
    const fields = (names: string[]) =>
      names.forEach((name) => string(body[name], `${path}.${name}`));
    switch (type) {
      case "receipt":
        fields(["vendor", "number", "date", "paymentMethod"]);
        if (body.body !== undefined) string(body.body, `${path}.body`);
        number(body.total, `${path}.total`);
        array(body.items, `${path}.items`, 1).forEach((inputItem, i) => {
          const itemPath = `${path}.items[${i}]`;
          const item = object(inputItem, itemPath);
          string(item.name, `${itemPath}.name`);
          number(item.amount, `${itemPath}.amount`);
        });
        break;
      case "contract":
        strings(body.parties, `${path}.parties`);
        fields(["date"]);
        strings(body.clauses, `${path}.clauses`);
        break;
      case "chat":
        strings(body.participants, `${path}.participants`);
        array(body.messages, `${path}.messages`, 1).forEach(
          (inputMessage, i) => {
            const messagePath = `${path}.messages[${i}]`;
            const message = object(inputMessage, messagePath);
            ["from", "time", "text"].forEach((field) =>
              string(message[field], `${messagePath}.${field}`),
            );
          },
        );
        break;
      case "email":
        fields(["from", "to", "date", "subject", "body"]);
        break;
      case "ad":
        fields(["headline", "body"]);
        ["phone", "address"].forEach((field) => {
          if (body[field] !== undefined)
            string(body[field], `${path}.${field}`);
        });
        break;
      case "bank_statement":
        fields(["owner"]);
        array(body.rows, `${path}.rows`, 1).forEach((inputRow, i) => {
          const rowPath = `${path}.rows[${i}]`;
          const row = object(inputRow, rowPath);
          string(row.date, `${rowPath}.date`);
          string(row.description, `${rowPath}.description`);
          number(row.amount, `${rowPath}.amount`);
        });
        break;
      case "note":
      case "record":
        fields(["body"]);
        if (body.heading !== undefined) string(body.heading, `${path}.heading`);
        break;
    }
  };

  const data = object(input, "case");
  ["id", "title", "brief", "claim"].forEach((field) =>
    string(data[field], field),
  );
  if (
    number(data.difficulty, "difficulty") &&
    (!Number.isInteger(data.difficulty) ||
      data.difficulty < 1 ||
      data.difficulty > 3)
  )
    errors.push("difficulty: expected an integer from 1 to 3.");
  if (number(data.estMinutes, "estMinutes") && data.estMinutes <= 0)
    errors.push("estMinutes: must be greater than zero.");
  boolean(data.premium, "premium");
  for (const field of ["gameDate", "worldDate"]) {
    if (data[field] !== undefined) calendarDate(data[field], field);
  }

  const characterIds = new Set<string>();
  array(data.characters, "characters", 1).forEach((inputCharacter, i) => {
    const path = `characters[${i}]`;
    const character = object(inputCharacter, path);
    uniqueId(character.id, `${path}.id`, characterIds);
    ["name", "role", "portrait"].forEach((field) =>
      string(character[field], `${path}.${field}`),
    );
  });
  const documentIds = new Set<string>();
  array(data.documents, "documents", 2).forEach((inputDocument, i) => {
    const path = `documents[${i}]`;
    const document = object(inputDocument, path);
    uniqueId(document.id, `${path}.id`, documentIds);
    string(document.title, `${path}.title`);
    string(document.text, `${path}.text`);
    boolean(document.initial, `${path}.initial`);
    enumeration(document.type, `${path}.type`, documentTypes);
    checkBody(document.type, document.body, `${path}.body`);
  });
  const searchIds = new Set<string>();
  array(data.searchIndex, "searchIndex").forEach((inputEntry, i) => {
    const path = `searchIndex[${i}]`;
    const entry = object(inputEntry, path);
    uniqueId(entry.id, `${path}.id`, searchIds);
    enumeration(entry.kind, `${path}.kind`, searchKinds);
    strings(entry.keys, `${path}.keys`).forEach((key, j) => {
      if (!normalize(key, entry.kind as SearchKind))
        errors.push(
          `${path}.keys[${j}]: must contain searchable letters or digits.`,
        );
    });
    const reveals = strings(entry.reveals, `${path}.reveals`);
    references(reveals, `${path}.reveals`, documentIds);
    if (new Set(reveals).size !== reveals.length)
      errors.push(`${path}.reveals: duplicate document ids.`);
  });
  const solution = object(data.solution, "solution");
  enumeration(solution.verdict, "solution.verdict", ["APPROVED", "DENIED"]);
  if (string(solution.culprit, "solution.culprit"))
    references([solution.culprit], "solution.culprit", characterIds);
  const methodIds = new Set<string>();
  array(solution.methods, "solution.methods", 3).forEach((inputMethod, i) => {
    const path = `solution.methods[${i}]`;
    const method = object(inputMethod, path);
    uniqueId(method.id, `${path}.id`, methodIds);
    string(method.text, `${path}.text`);
  });
  if (string(solution.correctMethod, "solution.correctMethod"))
    references([solution.correctMethod], "solution.correctMethod", methodIds);
  const requiredEvidence = strings(
    solution.requiredEvidence,
    "solution.requiredEvidence",
    2,
  );
  references(requiredEvidence, "solution.requiredEvidence", documentIds);
  if (new Set(requiredEvidence).size !== requiredEvidence.length)
    errors.push("solution.requiredEvidence: evidence ids must be distinct.");
  string(solution.explanation, "solution.explanation");
  return errors;
}

function searchActions(
  caseData: CaseData,
): { query: string; entries: number[] }[] {
  const entries = caseData.searchIndex;
  const keys = entries.flatMap((entry) => entry.keys);
  const normalized = [
    ...new Set(
      entries.flatMap((entry) =>
        entry.keys.map((key) => normalize(key, entry.kind)),
      ),
    ),
  ];
  const alphabet = [...new Set(normalized.join("") + " ")];
  const signatures = new Map<string, { query: string; entries: number[] }>();
  const consider = (query: string) => {
    const matching = entries.flatMap((entry, index) =>
      entryMatchesQuery(entry, query) ? [index] : [],
    );
    if (!matching.length) return;
    const signature = matching.join(",");
    if (!signatures.has(signature))
      signatures.set(signature, { query, entries: matching });
  };
  // Keep readable authored queries first. Different queries with the same
  // matching entries are equivalent for every possible opened-document state.
  keys.forEach(consider);
  normalized.forEach(consider);
  for (const key of normalized) {
    if (key.length < 6) continue;
    for (let i = 0; i <= key.length; i++) {
      if (i < key.length) consider(key.slice(0, i) + key.slice(i + 1));
      for (const character of alphabet) {
        consider(key.slice(0, i) + character + key.slice(i));
        if (i < key.length && character !== key[i])
          consider(key.slice(0, i) + character + key.slice(i + 1));
      }
    }
  }
  return [...signatures.values()];
}

function shortestSolution(
  caseData: CaseData,
  initial: string[],
): string[] | undefined {
  const required = new Set(caseData.solution.requiredEvidence);
  const hasSolution = (opened: string[]) =>
    opened.filter((id) => required.has(id)).length >= 2;
  const fingerprint = (opened: string[]) => [...opened].sort().join("\u0000");
  const queue = [{ opened: initial, path: [] as string[] }];
  const seen = new Set([fingerprint(initial)]);
  if (hasSolution(initial)) return [];
  const actions = searchActions(caseData);
  // A BFS node is the entire folder. Independent evidence branches each cost a
  // query, while a query revealing several documents costs exactly one.
  for (let index = 0; index < queue.length; index++) {
    const state = queue[index];
    if (hasSolution(state.opened)) return state.path;
    const openedSet = new Set(state.opened);
    const available = caseData.searchIndex.map((entry) =>
      isEntryAvailable(caseData, openedSet, entry),
    );
    for (const action of actions) {
      const revealed = action.entries
        .filter((entry) => available[entry])
        .flatMap((entry) => caseData.searchIndex[entry].reveals);
      const newIds = [...new Set(revealed)].filter((id) => !openedSet.has(id));
      if (!newIds.length) continue;
      const opened = [...state.opened, ...newIds];
      const key = fingerprint(opened);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ opened, path: [...state.path, action.query] });
    }
  }
  return undefined;
}

export function validateCase(input: unknown): ValidationReport {
  const report: ValidationReport = {
    valid: false,
    errors: schemaErrors(input),
    warnings: [],
    reachableDocumentIds: [],
    minimumSearches: -1,
    solutionPath: [],
  };
  if (report.errors.length) return report;
  const caseData = input as CaseData;
  const initial = caseData.documents
    .filter((document) => document.initial)
    .map((document) => document.id);
  const reachable = new Set(initial);
  const available = new Set<string>();
  // Monotonic closure establishes everything that can ever be discovered.
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of caseData.searchIndex) {
      if (!isEntryAvailable(caseData, reachable, entry)) continue;
      available.add(entry.id);
      for (const id of entry.reveals) {
        if (!reachable.has(id)) {
          reachable.add(id);
          changed = true;
        }
      }
    }
  }
  report.reachableDocumentIds = caseData.documents
    .filter((document) => reachable.has(document.id))
    .map((document) => document.id);
  for (const id of caseData.solution.requiredEvidence) {
    if (!reachable.has(id))
      report.errors.push(
        `solution.requiredEvidence: document “${id}” cannot be reached from the initial clues.`,
      );
  }
  if (reachable.size / caseData.documents.length < 0.8)
    report.errors.push(
      `documents: only ${reachable.size}/${caseData.documents.length} are reachable; at least 80% are required.`,
    );
  for (const entry of caseData.searchIndex) {
    if (!available.has(entry.id))
      report.warnings.push(
        `searchIndex: entry “${entry.id}” never becomes available; none of its keys appear in reachable clues.`,
      );
  }
  const path =
    caseData.solution.requiredEvidence.filter((id) => reachable.has(id))
      .length >= 2
      ? shortestSolution(caseData, initial)
      : undefined;
  if (path) {
    report.solutionPath = path;
    report.minimumSearches = path.length;
  } else
    report.errors.push(
      "solution: no sequence of searches reveals two distinct required evidence documents.",
    );
  report.valid = report.errors.length === 0;
  return report;
}

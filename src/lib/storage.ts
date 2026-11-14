import type { Accusation, CaseData } from "../types";
import {
  createRun,
  isPaidHint,
  MAX_ELAPSED_SECONDS,
  type GameRun,
} from "../store/game";
import { evaluateVerdict } from "../engine/verdict";
import type { HintOffer } from "../engine/hint";

export function safeRead<T>(key: string, fallback: T): T {
  try {
    const value = globalThis.localStorage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}

export function safeWrite(key: string, value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return false;
    globalThis.localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

function runKey(caseId: string): string {
  return `case-desk:run:v1:${caseId}`;
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
function knownIds(value: unknown[], allowed: Set<string>): string[] {
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === "string" && allowed.has(id),
      ),
    ),
  ];
}
function readAccusation(
  value: unknown,
  caseData: CaseData,
  opened: Set<string>,
): Accusation | null {
  if (!object(value)) return null;
  // Older saves stamped the complaint; the new stamps judge the respondent.
  const verdict =
    value.verdict === "APPROVED"
      ? "GUILTY"
      : value.verdict === "DENIED"
        ? "NOT_GUILTY"
        : value.verdict;
  if (
    (verdict !== "GUILTY" && verdict !== "NOT_GUILTY") ||
    typeof value.culprit !== "string" ||
    !caseData.characters.some((character) => character.id === value.culprit) ||
    typeof value.method !== "string" ||
    !caseData.solution.methods.some((method) => method.id === value.method) ||
    !Array.isArray(value.evidence) ||
    value.evidence.length !== 2 ||
    value.evidence.some((id) => typeof id !== "string" || !opened.has(id)) ||
    new Set(value.evidence).size !== 2
  )
    return null;
  return {
    verdict,
    culprit: value.culprit,
    method: value.method,
    evidence: [...value.evidence] as string[],
  };
}

export function saveRun(run: GameRun): boolean {
  return safeWrite(runKey(run.caseId), run);
}

function legacyRunId(value: Record<string, unknown>): string {
  // Deterministic identity prevents repeat awards even if a legacy save cannot
  // be migrated because the browser allows reads but rejects writes.
  const serialized = JSON.stringify(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < serialized.length; index++) {
    first = Math.imul(first ^ serialized.charCodeAt(index), 0x01000193);
    second = Math.imul(second ^ serialized.charCodeAt(index), 0x85ebca6b);
  }
  return `legacy-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

// Early builds used a different city. Keep saved leads usable with current case
// content while preserving run IDs, hint receipts, evidence, and elapsed time.
function currentPlaceName(text: string): string {
  return text.replace(/\bHarlow(?:\s+Creek)?\b/gi, match =>
    match === match.toUpperCase() ? "RIVERTON" : "Riverton",
  );
}

function readHints(value: unknown): HintOffer[] {
  if (!Array.isArray(value)) return [];
  const hints: HintOffer[] = [];
  for (const hint of value) {
    if (
      !isPaidHint(hint) ||
      hints.some(
        (item) => item.stepKey === hint.stepKey && item.level === hint.level,
      )
    )
      continue;
    hints.push({
      stepKey: hint.stepKey,
      level: hint.level,
      message: currentPlaceName(hint.message),
      free: false,
      ...(hint.query !== undefined ? { query: currentPlaceName(hint.query) } : {}),
    });
  }
  return hints;
}

export function loadRun(caseData: CaseData): GameRun | null {
  const value = safeRead<unknown>(runKey(caseData.id), null);
  if (
    !object(value) ||
    value.caseId !== caseData.id ||
    (value.runId !== undefined &&
      (typeof value.runId !== "string" ||
        !value.runId.trim() ||
        value.runId.length > 200)) ||
    (value.hints !== undefined && !Array.isArray(value.hints)) ||
    !Array.isArray(value.openedIds) ||
    !Array.isArray(value.seenIds) ||
    !Array.isArray(value.pinnedIds) ||
    !Array.isArray(value.queries) ||
    !validInteger(value.wrongAttempts, 0, 3) ||
    !validInteger(value.elapsedSeconds, 0, MAX_ELAPSED_SECONDS) ||
    !["playing", "solved", "failed"].includes(value.status as string) ||
    (value.status === "failed") !== (value.wrongAttempts === 3) ||
    value.elapsedSeconds < value.wrongAttempts * 60
  )
    return null;

  const initial = createRun(caseData);
  const allIds = new Set(caseData.documents.map((document) => document.id));
  const openedIds = [
    ...new Set([...initial.openedIds, ...knownIds(value.openedIds, allIds)]),
  ];
  const opened = new Set(openedIds);
  const run: GameRun = {
    ...initial,
    runId: typeof value.runId === "string" ? value.runId : legacyRunId(value),
    hints: readHints(value.hints),
    openedIds,
    seenIds: knownIds(value.seenIds, opened),
    pinnedIds: knownIds(value.pinnedIds, opened),
    wrongAttempts: value.wrongAttempts,
    elapsedSeconds: value.elapsedSeconds,
    status: value.status as GameRun["status"],
    queries: value.queries.flatMap((entry) => {
      if (
        !object(entry) ||
        typeof entry.query !== "string" ||
        !entry.query.trim() ||
        !Array.isArray(entry.documentIds) ||
        typeof entry.newCount !== "number" ||
        !Number.isFinite(entry.newCount) ||
        entry.newCount < 0
      )
        return [];
      const documentIds = knownIds(entry.documentIds, opened);
      return [
        {
          query: currentPlaceName(entry.query.trim()),
          documentIds,
          newCount: Math.min(documentIds.length, Math.floor(entry.newCount)),
        },
      ];
    }),
  };

  if (value.lastAccusation !== undefined) {
    const accusation = readAccusation(value.lastAccusation, caseData, opened);
    if (!accusation) return null;
    run.lastAccusation = accusation;
  }
  const solved =
    !!run.lastAccusation && evaluateVerdict(caseData, run.lastAccusation);
  if (run.status === "solved") {
    if (
      !solved ||
      !run.lastAccusation!.evidence.every((id) => run.pinnedIds.includes(id))
    )
      return null;
  } else if (
    solved ||
    (run.wrongAttempts > 0 && !run.lastAccusation) ||
    (run.wrongAttempts === 0 && run.lastAccusation)
  )
    return null;
  // Commit migration before the result screen can award this run's fee.
  if (
    value.runId === undefined ||
    value.hints === undefined ||
    (object(value.lastAccusation) &&
      value.lastAccusation.verdict !== run.lastAccusation?.verdict)
  )
    saveRun(run);
  return run;
}

export function clearRun(caseId: string): void {
  try {
    globalThis.localStorage.removeItem(runKey(caseId));
  } catch {
    /* A blocked browser store cannot prevent a new game. */
  }
}

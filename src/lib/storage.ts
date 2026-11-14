import type { Accusation, CaseData } from "../types";
import { createRun, MAX_ELAPSED_SECONDS, type GameRun } from "../store/game";
import { evaluateVerdict } from "../engine/verdict";

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
  if (
    !object(value) ||
    (value.verdict !== "APPROVED" && value.verdict !== "DENIED") ||
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
    verdict: value.verdict,
    culprit: value.culprit,
    method: value.method,
    evidence: [...value.evidence] as string[],
  };
}

export function saveRun(run: GameRun): boolean {
  return safeWrite(runKey(run.caseId), run);
}

export function loadRun(caseData: CaseData): GameRun | null {
  const value = safeRead<unknown>(runKey(caseData.id), null);
  if (
    !object(value) ||
    value.caseId !== caseData.id ||
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
          query: entry.query.trim(),
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
  return run;
}

export function clearRun(caseId: string): void {
  try {
    globalThis.localStorage.removeItem(runKey(caseId));
  } catch {
    /* A blocked browser store cannot prevent a new game. */
  }
}

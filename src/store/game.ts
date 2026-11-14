import type { Accusation, CaseData } from "../types";
import { searchCase } from "../engine/search";
import { evaluateVerdict } from "../engine/verdict";
import type { HintOffer } from "../engine/hint";

// The cap keeps milliseconds inside a PostgreSQL signed integer for score records.
export const MAX_ELAPSED_SECONDS = 2_147_483;
let runSequence = 0;

export interface GameRun {
  runId: string;
  caseId: string;
  openedIds: string[];
  seenIds: string[];
  pinnedIds: string[];
  queries: Array<{ query: string; documentIds: string[]; newCount: number }>;
  hints: HintOffer[];
  wrongAttempts: number;
  elapsedSeconds: number;
  status: "playing" | "solved" | "failed";
  lastAccusation?: Accusation;
}
export type GameAction =
  | { type: "search"; caseData: CaseData; query: string }
  | { type: "read"; documentId: string }
  | { type: "pin"; documentId: string }
  | { type: "tick"; seconds: number }
  | { type: "hint"; hint: HintOffer }
  | { type: "accuse"; caseData: CaseData; accusation: Accusation };

export function createRun(caseData: CaseData): GameRun {
  return {
    runId:
      globalThis.crypto?.randomUUID?.() ??
      `run-${Date.now().toString(36)}-${(++runSequence).toString(36)}-${Math.random().toString(36).slice(2)}`,
    caseId: caseData.id,
    openedIds: [
      ...new Set(
        caseData.documents
          .filter((document) => document.initial)
          .map((document) => document.id),
      ),
    ],
    seenIds: [],
    pinnedIds: [],
    queries: [],
    hints: [],
    wrongAttempts: 0,
    elapsedSeconds: 0,
    status: "playing",
  };
}

export function isPaidHint(value: unknown): value is HintOffer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const hint = value as Record<string, unknown>;
  return (
    hint.free === false &&
    (hint.level === 1 || hint.level === 2) &&
    typeof hint.stepKey === "string" &&
    !!hint.stepKey.trim() &&
    typeof hint.message === "string" &&
    !!hint.message.trim() &&
    (hint.query === undefined ||
      (typeof hint.query === "string" && !!hint.query.trim()))
  );
}

function sameAccusation(
  first: Accusation | undefined,
  second: Accusation,
): boolean {
  return (
    !!first &&
    first.verdict === second.verdict &&
    first.culprit === second.culprit &&
    first.method === second.method &&
    first.evidence.length === second.evidence.length &&
    first.evidence.every((id) => second.evidence.includes(id))
  );
}

export function gameReducer(state: GameRun, action: GameAction): GameRun {
  if (state.status !== "playing") return state;

  switch (action.type) {
    case "hint": {
      const hint = action.hint;
      if (
        !isPaidHint(hint) ||
        state.hints.some(
          (existing) =>
            existing.stepKey === hint.stepKey && existing.level === hint.level,
        )
      )
        return state;
      return {
        ...state,
        hints: [
          ...state.hints,
          {
            stepKey: hint.stepKey,
            level: hint.level,
            message: hint.message,
            free: false,
            ...(hint.query !== undefined ? { query: hint.query } : {}),
          },
        ],
      };
    }
    case "search": {
      if (
        action.caseData.id !== state.caseId ||
        typeof action.query !== "string"
      )
        return state;
      const query = action.query.trim();
      if (!query) return state;
      const result = searchCase(action.caseData, state.openedIds, query);
      return {
        ...state,
        openedIds: [...new Set([...state.openedIds, ...result.newDocumentIds])],
        queries: [
          ...state.queries,
          {
            query,
            documentIds: [...result.documentIds],
            newCount: result.newDocumentIds.length,
          },
        ],
      };
    }
    case "read":
      if (
        !state.openedIds.includes(action.documentId) ||
        state.seenIds.includes(action.documentId)
      )
        return state;
      return { ...state, seenIds: [...state.seenIds, action.documentId] };
    case "pin":
      if (!state.openedIds.includes(action.documentId)) return state;
      return {
        ...state,
        pinnedIds: state.pinnedIds.includes(action.documentId)
          ? state.pinnedIds.filter((id) => id !== action.documentId)
          : [...state.pinnedIds, action.documentId],
      };
    case "tick": {
      if (!Number.isFinite(action.seconds) || action.seconds <= 0) return state;
      const elapsedSeconds = Math.min(
        MAX_ELAPSED_SECONDS,
        state.elapsedSeconds + Math.floor(action.seconds),
      );
      return elapsedSeconds === state.elapsedSeconds
        ? state
        : { ...state, elapsedSeconds };
    }
    case "accuse": {
      const { accusation, caseData } = action;
      if (
        caseData.id !== state.caseId ||
        !accusation ||
        !["APPROVED", "DENIED"].includes(accusation.verdict) ||
        !caseData.characters.some(
          (character) => character.id === accusation.culprit,
        ) ||
        !caseData.solution.methods.some(
          (method) => method.id === accusation.method,
        ) ||
        !Array.isArray(accusation.evidence) ||
        accusation.evidence.length !== 2 ||
        new Set(accusation.evidence).size !== 2 ||
        !accusation.evidence.every(
          (id) => state.openedIds.includes(id) && state.pinnedIds.includes(id),
        )
      )
        return state;

      // A repeated click cannot burn another life. A revised answer enables the next attempt.
      if (sameAccusation(state.lastAccusation, accusation)) return state;
      const lastAccusation = {
        ...accusation,
        evidence: [...accusation.evidence],
      };
      if (evaluateVerdict(caseData, accusation))
        return { ...state, status: "solved", lastAccusation };
      const wrongAttempts = state.wrongAttempts + 1;
      return {
        ...state,
        lastAccusation,
        wrongAttempts,
        elapsedSeconds: Math.min(
          MAX_ELAPSED_SECONDS,
          state.elapsedSeconds + 60,
        ),
        status: wrongAttempts >= 3 ? "failed" : "playing",
      };
    }
    default:
      return state;
  }
}

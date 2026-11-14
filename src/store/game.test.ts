import { describe, expect, it } from "vitest";
import type { Accusation, CaseData } from "../types";
import { createRun, gameReducer, type GameRun } from "./game";

const caseData: CaseData = {
  id: "test-case",
  title: "Test",
  difficulty: 1,
  estMinutes: 5,
  premium: false,
  brief: "Contact Alpha.",
  claim: "Refund me.",
  characters: [
    { id: "client", name: "Client", role: "Claimant", portrait: "" },
    { id: "vendor", name: "Vendor", role: "Vendor", portrait: "" },
  ],
  documents: [
    {
      id: "initial",
      type: "note",
      title: "Claim",
      initial: true,
      body: { body: "Alpha" },
      text: "Alpha",
    },
    {
      id: "invoice",
      type: "note",
      title: "Invoice",
      initial: false,
      body: { body: "Order 7788" },
      text: "Order 7788",
    },
    {
      id: "bank",
      type: "note",
      title: "Bank",
      initial: false,
      body: { body: "Proof" },
      text: "Proof",
    },
  ],
  searchIndex: [
    { id: "alpha", kind: "company", keys: ["Alpha"], reveals: ["invoice"] },
    { id: "order", kind: "order", keys: ["7788"], reveals: ["bank"] },
  ],
  solution: {
    verdict: "APPROVED",
    culprit: "vendor",
    methods: [
      { id: "double", text: "Double charged" },
      { id: "error", text: "Error" },
      { id: "lie", text: "Lied" },
    ],
    correctMethod: "double",
    requiredEvidence: ["invoice", "bank"],
    explanation: "Two charges.",
  },
};
const correct: Accusation = {
  verdict: "APPROVED",
  culprit: "vendor",
  method: "double",
  evidence: ["invoice", "bank"],
};
const accuse = (state: GameRun, accusation: Accusation) =>
  gameReducer(state, { type: "accuse", caseData, accusation });
function readyRun() {
  let run = createRun(caseData);
  run = gameReducer(run, { type: "search", caseData, query: "Alpha" });
  run = gameReducer(run, { type: "search", caseData, query: "7788" });
  run = gameReducer(run, { type: "pin", documentId: "invoice" });
  return gameReducer(run, { type: "pin", documentId: "bank" });
}

describe("game reducer", () => {
  it("starts with only the initial documents, all unread", () => {
    expect(createRun(caseData)).toEqual({
      caseId: "test-case",
      openedIds: ["initial"],
      seenIds: [],
      pinnedIds: [],
      queries: [],
      wrongAttempts: 0,
      elapsedSeconds: 0,
      status: "playing",
    });
  });

  it("records only nonempty searches and counts only newly discovered documents", () => {
    const start = createRun(caseData);
    expect(gameReducer(start, { type: "search", caseData, query: "   " })).toBe(
      start,
    );
    const first = gameReducer(start, {
      type: "search",
      caseData,
      query: "  Alpha  ",
    });
    expect(first.openedIds).toEqual(["initial", "invoice"]);
    expect(first.queries).toEqual([
      { query: "Alpha", documentIds: ["invoice"], newCount: 1 },
    ]);
    const repeat = gameReducer(first, {
      type: "search",
      caseData,
      query: "Alpha",
    });
    expect(repeat.openedIds).toEqual(["initial", "invoice"]);
    expect(repeat.queries[1]).toEqual({
      query: "Alpha",
      documentIds: ["invoice"],
      newCount: 0,
    });
  });

  it("tracks reading and allows pinning only opened documents", () => {
    const start = createRun(caseData);
    expect(gameReducer(start, { type: "pin", documentId: "bank" })).toBe(start);
    expect(gameReducer(start, { type: "read", documentId: "bank" })).toBe(
      start,
    );
    const read = gameReducer(start, { type: "read", documentId: "initial" });
    expect(read.seenIds).toEqual(["initial"]);
    expect(gameReducer(read, { type: "read", documentId: "initial" })).toBe(
      read,
    );
    const pinned = gameReducer(read, { type: "pin", documentId: "initial" });
    expect(pinned.pinnedIds).toEqual(["initial"]);
    expect(
      gameReducer(pinned, { type: "pin", documentId: "initial" }).pinnedIds,
    ).toEqual([]);
  });

  it("requires two distinct opened and pinned documents before accepting an accusation", () => {
    const start = createRun(caseData);
    expect(accuse(start, correct)).toBe(start);
    const ready = readyRun();
    expect(
      accuse(ready, { ...correct, evidence: ["invoice", "invoice"] }),
    ).toBe(ready);
    expect(accuse(ready, { ...correct, evidence: ["invoice"] })).toBe(ready);
    expect(accuse(ready, { ...correct, culprit: "unknown" })).toBe(ready);
    expect(
      accuse(gameReducer(ready, { type: "pin", documentId: "bank" }), correct)
        .status,
    ).toBe("playing");
    expect(accuse(ready, correct).status).toBe("solved");
  });

  it("charges three different wrong answers and freezes the failed run", () => {
    let run = readyRun();
    run = gameReducer(run, { type: "tick", seconds: 10 });
    run = accuse(run, { ...correct, verdict: "DENIED" });
    expect(run).toMatchObject({
      wrongAttempts: 1,
      elapsedSeconds: 70,
      status: "playing",
    });
    run = accuse(run, { ...correct, method: "error" });
    run = accuse(run, { ...correct, culprit: "client" });
    expect(run).toMatchObject({
      wrongAttempts: 3,
      elapsedSeconds: 190,
      status: "failed",
    });
    expect(accuse(run, correct)).toBe(run);
    expect(gameReducer(run, { type: "tick", seconds: 10 })).toBe(run);
    expect(gameReducer(run, { type: "search", caseData, query: "Alpha" })).toBe(
      run,
    );
    expect(gameReducer(run, { type: "pin", documentId: "bank" })).toBe(run);
    expect(gameReducer(run, { type: "read", documentId: "bank" })).toBe(run);
  });

  it("does not charge a duplicate accusation twice even when evidence order changes", () => {
    const wrong = { ...correct, verdict: "DENIED" as const };
    const run = accuse(readyRun(), wrong);
    expect(accuse(run, wrong)).toBe(run);
    expect(accuse(run, { ...wrong, evidence: ["bank", "invoice"] })).toBe(run);
    expect(
      accuse(gameReducer(run, { type: "tick", seconds: 1 }), wrong)
        .wrongAttempts,
    ).toBe(1);
  });

  it("copies an accusation so later caller mutation cannot alter persisted state", () => {
    const accusation = { ...correct, evidence: ["invoice", "bank"] };
    const run = accuse(readyRun(), accusation);
    accusation.evidence.length = 0;
    expect(run.lastAccusation?.evidence).toEqual(["invoice", "bank"]);
    expect(gameReducer(run, { type: "tick", seconds: 1 })).toBe(run);
  });

  it("ignores invalid time deltas, rounds seconds, and bounds elapsed time", () => {
    const start = createRun(caseData);
    for (const seconds of [-1, Number.NaN, Number.POSITIVE_INFINITY, 0])
      expect(gameReducer(start, { type: "tick", seconds })).toBe(start);
    expect(
      gameReducer(start, { type: "tick", seconds: 2.9 }).elapsedSeconds,
    ).toBe(2);
    expect(
      gameReducer(start, { type: "tick", seconds: Number.MAX_VALUE })
        .elapsedSeconds,
    ).toBe(2_147_483);
  });

  it("rejects case data from another run", () => {
    const start = readyRun();
    const other = { ...caseData, id: "other" };
    expect(
      gameReducer(start, { type: "search", caseData: other, query: "Alpha" }),
    ).toBe(start);
    expect(
      gameReducer(start, {
        type: "accuse",
        caseData: other,
        accusation: correct,
      }),
    ).toBe(start);
  });
});

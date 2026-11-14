import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseData } from "../types";
import { createRun } from "../store/game";
import { clearRun, loadRun, safeRead, safeWrite, saveRun } from "./storage";

const caseData: CaseData = {
  id: "persistence-test",
  title: "Case",
  difficulty: 1,
  estMinutes: 5,
  premium: false,
  brief: "Alpha",
  claim: { number: "001", claimant: "vendor", respondent: "Arbor Repairs", request: "Refund", amount: 100, statement: "Refund" },
  characters: [{ id: "vendor", name: "Vendor", role: "Vendor", portrait: "" }],
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
      id: "one",
      type: "note",
      title: "One",
      initial: false,
      body: { body: "One" },
      text: "One",
    },
    {
      id: "two",
      type: "note",
      title: "Two",
      initial: false,
      body: { body: "Two" },
      text: "Two",
    },
  ],
  searchIndex: [
    { id: "alpha", keys: ["Alpha"], kind: "company", reveals: ["one", "two"] },
  ],
  solution: {
    verdict: "GUILTY",
    culprit: "vendor",
    methods: [
      { id: "double", text: "Double" },
      { id: "error", text: "Error" },
      { id: "lie", text: "Lie" },
    ],
    correctMethod: "double",
    requiredEvidence: ["one", "two"],
    explanation: "Solved",
  },
};
let memory: Map<string, string>;
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("safe storage", () => {
  it("returns fallbacks for missing and malformed JSON", () => {
    expect(safeRead("missing", 7)).toBe(7);
    memory.set("broken", "{unfinished");
    expect(safeRead("broken", [])).toEqual([]);
    expect(safeWrite("working", { hello: "world" })).toBe(true);
    expect(safeRead("working", null)).toEqual({ hello: "world" });
  });

  it("never crashes when the browser denies storage access or serialization fails", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(safeRead("blocked", false)).toBe(false);
    expect(safeWrite("blocked", "value")).toBe(false);
    expect(saveRun(createRun(caseData))).toBe(false);
    expect(loadRun(caseData)).toBeNull();
    expect(() => clearRun(caseData.id)).not.toThrow();
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(safeWrite("cyclic", cyclic)).toBe(false);
  });
});

describe("saved runs", () => {
  it("migrates a solved legacy save before its result can award a fee", () => {
    saveRun(createRun(caseData));
    const key = [...memory.keys()][0];
    const old = JSON.parse(memory.get(key)!);
    delete old.runId;
    delete old.hints;
    old.openedIds = ["initial", "one", "two"];
    old.pinnedIds = ["one", "two"];
    old.status = "solved";
    old.lastAccusation = {
      verdict: "GUILTY",
      culprit: "vendor",
      method: "double",
      evidence: ["one", "two"],
    };
    memory.set(key, JSON.stringify(old));
    const migrated = loadRun(caseData)!;
    expect(migrated.runId).toBeTruthy();
    expect(migrated.status).toBe("solved");
    expect(migrated.hints).toEqual([]);
    expect(JSON.parse(memory.get(key)!).runId).toBe(migrated.runId);
    expect(loadRun(caseData)?.runId).toBe(migrated.runId);
  });

  it("keeps legacy award identity stable when migration cannot write storage", () => {
    saveRun(createRun(caseData));
    const key = [...memory.keys()][0];
    const old = JSON.parse(memory.get(key)!);
    delete old.runId;
    delete old.hints;
    memory.set(key, JSON.stringify(old));
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem() {
        throw new Error("quota");
      },
    });
    const first = loadRun(caseData)!;
    const second = loadRun(caseData)!;
    expect(first.runId).toBeTruthy();
    expect(first.runId).toBe(second.runId);
  });

  it("preserves paid hint history and removes free, duplicate, and malformed entries", () => {
    const hint = {
      stepKey: "persistence-test:alpha",
      level: 1 as const,
      message: "Check the claim.",
      free: false,
    };
    const run = { ...createRun(caseData), hints: [hint] };
    saveRun(run);
    expect(loadRun(caseData)).toEqual(run);
    const key = [...memory.keys()][0];
    const corrupt = JSON.parse(memory.get(key)!);
    corrupt.hints = [
      hint,
      { ...hint, message: "Duplicate" },
      null,
      { ...hint, level: 0, free: true },
      { ...hint, stepKey: "" },
      { ...hint, level: 2, query: "Alpha", message: "Search: Alpha" },
    ];
    memory.set(key, JSON.stringify(corrupt));
    expect(loadRun(caseData)?.hints).toEqual([
      hint,
      { ...hint, level: 2, query: "Alpha", message: "Search: Alpha" },
    ]);
  });

  it("round-trips a run and clears only that case", () => {
    const run = {
      ...createRun(caseData),
      openedIds: ["initial", "one"],
      pinnedIds: ["one"],
      seenIds: ["initial"],
      elapsedSeconds: 42,
      queries: [{ query: "Alpha", documentIds: ["one"], newCount: 1 }],
    };
    expect(saveRun(run)).toBe(true);
    expect(loadRun(caseData)).toEqual(run);
    const other = { ...caseData, id: "another-case" };
    saveRun(createRun(other));
    clearRun(caseData.id);
    expect(loadRun(caseData)).toBeNull();
    expect(loadRun(other)?.caseId).toBe("another-case");
  });

  it("removes invalid ids and duplicates while preserving the initial folder", () => {
    saveRun(createRun(caseData));
    const key = [...memory.keys()][0];
    const value = JSON.parse(memory.get(key)!);
    value.openedIds = ["one", "one", "missing", 2];
    value.seenIds = ["one", "missing", "two", "one"];
    value.pinnedIds = ["one", "two", "missing"];
    value.queries = [
      {
        query: " Alpha ",
        documentIds: ["one", "missing", "one"],
        newCount: 99,
      },
      { query: "", documentIds: [], newCount: 0 },
      null,
    ];
    memory.set(key, JSON.stringify(value));
    expect(loadRun(caseData)).toMatchObject({
      openedIds: ["initial", "one"],
      seenIds: ["one"],
      pinnedIds: ["one"],
      queries: [{ query: "Alpha", documentIds: ["one"], newCount: 1 }],
    });
  });

  it("discards malformed or inconsistent runs instead of throwing", () => {
    saveRun(createRun(caseData));
    const key = [...memory.keys()][0];
    for (const invalid of [
      null,
      [],
      1,
      {},
      { ...createRun(caseData), openedIds: null },
      { ...createRun(caseData), wrongAttempts: "one" },
      { ...createRun(caseData), elapsedSeconds: -1 },
      { ...createRun(caseData), caseId: "wrong" },
      { ...createRun(caseData), status: "invented" },
      { ...createRun(caseData), status: "solved" },
      { ...createRun(caseData), status: "failed" },
      { ...createRun(caseData), wrongAttempts: 3 },
    ]) {
      memory.set(key, JSON.stringify(invalid));
      expect(loadRun(caseData)).toBeNull();
    }
  });

  it("validates a completed accusation before resuming solved results", () => {
    const solved = {
      ...createRun(caseData),
      openedIds: ["initial", "one", "two"],
      pinnedIds: ["one", "two"],
      status: "solved" as const,
      lastAccusation: {
        verdict: "GUILTY" as const,
        culprit: "vendor",
        method: "double",
        evidence: ["one", "two"],
      },
    };
    saveRun(solved);
    expect(loadRun(caseData)?.status).toBe("solved");
    saveRun({ ...solved, pinnedIds: ["one"] });
    expect(loadRun(caseData)).toBeNull();
    saveRun({
      ...solved,
      lastAccusation: { ...solved.lastAccusation, evidence: ["one", "one"] },
    });
    expect(loadRun(caseData)).toBeNull();
  });
});

describe("legacy verdict migration", () => {
  it.each([["APPROVED", "GUILTY"], ["DENIED", "NOT_GUILTY"]] as const)(
    "preserves a completed %s run as %s without a new award identity",
    (legacy, current) => {
      const migratedCase = {
        ...caseData,
        solution: { ...caseData.solution, verdict: current },
      };
      const run = {
        ...createRun(migratedCase),
        runId: "already-paid-run",
        openedIds: ["initial", "one", "two"],
        pinnedIds: ["one", "two"],
        elapsedSeconds: 125,
        status: "solved",
        lastAccusation: {
          verdict: legacy, culprit: "vendor", method: "double",
          evidence: ["one", "two"],
        },
      };
      const key = `case-desk:run:v1:${migratedCase.id}`;
      memory.set(key, JSON.stringify(run));
      expect(loadRun(migratedCase)).toMatchObject({
        runId: "already-paid-run", status: "solved", elapsedSeconds: 125,
        pinnedIds: ["one", "two"], lastAccusation: { verdict: current },
      });
      expect(JSON.parse(memory.get(key)!)).toMatchObject({
        runId: "already-paid-run", lastAccusation: { verdict: current },
      });
    },
  );
  it("migrates an incorrect verdict and keeps the used attempt and penalty", () => {
    const key = `case-desk:run:v1:${caseData.id}`;
    memory.set(key, JSON.stringify({
      ...createRun(caseData),
      runId: "ongoing-run",
      openedIds: ["initial", "one", "two"],
      pinnedIds: ["one", "two"],
      wrongAttempts: 1,
      elapsedSeconds: 95,
      lastAccusation: {
        verdict: "DENIED", culprit: "vendor", method: "double",
        evidence: ["one", "two"],
      },
    }));
    expect(loadRun(caseData)).toMatchObject({
      runId: "ongoing-run", status: "playing", wrongAttempts: 1,
      elapsedSeconds: 95, lastAccusation: { verdict: "NOT_GUILTY" },
    });
  });
});

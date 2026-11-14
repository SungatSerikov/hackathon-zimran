import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameRun } from "../store/game";
import type { HintOffer } from "./hint";
import { makeCase } from "./test-fixtures";

const caseData = { ...makeCase(), difficulty: 2, estMinutes: 10 };
function run(id = "run-1", status: GameRun["status"] = "solved"): GameRun {
  return {
    runId: id,
    caseId: caseData.id,
    openedIds: [],
    seenIds: [],
    pinnedIds: [],
    queries: [],
    hints: [],
    wrongAttempts: status === "failed" ? 3 : 0,
    elapsedSeconds: 600,
    status,
  };
}
const hint = (stepKey = "company", level: 1 | 2 = 1): HintOffer => ({
  stepKey,
  level,
  message: "Look at the company.",
  free: false,
});
let storage: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("case fees", () => {
  it.each([
    [600, 0, false, 350],
    [601, 0, false, 300],
    [900, 0, false, 300],
    [901, 0, false, 250],
    [600, 1, false, 300],
    [600, 3, false, 0],
    [600, 0, true, 87.5],
    [901, 1, true, 50],
  ])(
    "calculates the boundary fee for %i seconds, %i mistakes, repeat %s",
    async (elapsedSeconds, wrongAttempts, repeat, expected) => {
      const { calculateFee } = await import("./wallet");
      expect(
        calculateFee(caseData, { elapsedSeconds, wrongAttempts }, repeat),
      ).toBe(expected);
    },
  );

  it("rejects invalid fee inputs instead of minting cash", async () => {
    const { calculateFee } = await import("./wallet");
    expect(
      calculateFee(caseData, { elapsedSeconds: NaN, wrongAttempts: 0 }),
    ).toBe(0);
    expect(
      calculateFee(caseData, { elapsedSeconds: -1, wrongAttempts: 0 }),
    ).toBe(0);
    expect(calculateFee({ ...caseData, difficulty: 0 }, run())).toBe(0);
    expect(
      calculateFee(caseData, { elapsedSeconds: 100, wrongAttempts: -1 }),
    ).toBe(0);
  });

  it("preserves exact quarter-dollar repeat fees", async () => {
    const { calculateFee } = await import("./wallet");
    expect(
      calculateFee(makeCase(), { elapsedSeconds: 301, wrongAttempts: 0 }, true),
    ).toBe(43.75);
  });

  it("awards a solved run once and returns the original fee on re-entry and reload", async () => {
    let wallet = await import("./wallet");
    const first = wallet.awardCaseFee(caseData, run());
    expect(first).toMatchObject({
      fee: 350,
      alreadyAwarded: false,
      wallet: { balance: 450 },
    });
    expect(wallet.awardCaseFee(caseData, run())).toMatchObject({
      fee: 350,
      alreadyAwarded: true,
      wallet: { balance: 450 },
    });
    vi.resetModules();
    wallet = await import("./wallet");
    expect(wallet.awardCaseFee(caseData, run())).toMatchObject({
      fee: 350,
      alreadyAwarded: true,
      wallet: { balance: 450 },
    });
    expect(wallet.getWallet().history).toHaveLength(1);
  });

  it("pays only a quarter on another solved run of the same case", async () => {
    const wallet = await import("./wallet");
    wallet.awardCaseFee(caseData, run());
    expect(wallet.awardCaseFee(caseData, run("run-2"))).toMatchObject({
      fee: 87.5,
      alreadyAwarded: false,
      wallet: { balance: 537.5 },
    });
  });

  it("never pays for a failed, unfinished, or mismatched case", async () => {
    const wallet = await import("./wallet");
    for (const state of [
      run("failed", "failed"),
      run("playing", "playing"),
      { ...run(), caseId: "other" },
    ]) {
      expect(wallet.awardCaseFee(caseData, state)).toMatchObject({
        fee: 0,
        alreadyAwarded: false,
        wallet: { balance: 100 },
      });
    }
    expect(wallet.getWallet().history).toEqual([]);
  });

  it("keeps award receipts after visible history is truncated", async () => {
    const wallet = await import("./wallet");
    for (let index = 0; index < 105; index++)
      wallet.awardCaseFee(caseData, run(`run-${index}`));
    const balance = wallet.getWallet().balance;
    expect(wallet.getWallet().history.length).toBeLessThanOrEqual(100);
    vi.resetModules();
    const fresh = await import("./wallet");
    expect(fresh.awardCaseFee(caseData, run("run-0"))).toMatchObject({
      fee: 350,
      alreadyAwarded: true,
      wallet: { balance },
    });
  });
});

describe("hint purchases", () => {
  it("charges forty dollars per distinct paid hint and refuses an unaffordable third", async () => {
    const wallet = await import("./wallet");
    const state = run("active", "playing");
    expect(wallet.purchaseHint(caseData, state, hint())).toMatchObject({
      success: true,
      charged: 40,
      wallet: { balance: 60 },
    });
    expect(
      wallet.purchaseHint(caseData, state, hint("company", 2)),
    ).toMatchObject({ success: true, charged: 40, wallet: { balance: 20 } });
    expect(wallet.purchaseHint(caseData, state, hint("phone"))).toMatchObject({
      success: false,
      charged: 0,
      wallet: { balance: 20 },
    });
    expect(wallet.getWallet().history.map((entry) => entry.amount)).toEqual([
      -40, -40,
    ]);
  });

  it("restores a purchased hint without charging twice even when the run did not save", async () => {
    let wallet = await import("./wallet");
    const state = run("active", "playing");
    wallet.purchaseHint(caseData, state, hint());
    vi.resetModules();
    wallet = await import("./wallet");
    expect(wallet.purchaseHint(caseData, state, hint())).toMatchObject({
      success: true,
      charged: 0,
      wallet: { balance: 60 },
    });
    expect(wallet.getWallet().history).toHaveLength(1);
  });

  it("allows free verdict guidance and repeated offers but rejects terminal purchases", async () => {
    const wallet = await import("./wallet");
    const state = run("active", "playing");
    for (const offer of [
      { ...hint(), level: 0 as const, free: true },
      { ...hint("company", 2), free: true },
    ]) {
      expect(wallet.purchaseHint(caseData, state, offer)).toMatchObject({
        success: true,
        charged: 0,
        wallet: { balance: 100 },
      });
    }
    expect(wallet.purchaseHint(caseData, run(), hint())).toMatchObject({
      success: false,
      charged: 0,
    });
    expect(
      wallet.purchaseHint(caseData, run("failed", "failed"), hint()),
    ).toMatchObject({ success: false, charged: 0 });
    expect(wallet.getWallet().history).toEqual([]);
  });

  it("rejects malformed hint queries before charging", async () => {
    const wallet = await import("./wallet");
    for (const query of [{ text: "company" }, "", "   "]) {
      const invalid = { ...hint("company", 2), query } as unknown as HintOffer;
      expect(
        wallet.purchaseHint(caseData, run("active", "playing"), invalid),
      ).toMatchObject({ success: false, charged: 0, wallet: { balance: 100 } });
    }
  });
});

describe("wallet persistence", () => {
  it.each([
    null,
    [],
    { balance: -1, history: [] },
    { balance: "100", history: [] },
    { balance: 1e100, history: [] },
  ])("resets malformed wallet data safely: %j", async (value) => {
    storage.set("cd.wallet", JSON.stringify(value));
    const wallet = await import("./wallet");
    expect(wallet.getWallet()).toMatchObject({ balance: 100, history: [] });
  });

  it("handles malformed JSON and blocked storage, retaining session receipts", async () => {
    storage.set("cd.wallet", "{broken");
    const wallet = await import("./wallet");
    expect(wallet.getWallet().balance).toBe(100);
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    });
    wallet.awardCaseFee(caseData, run());
    expect(wallet.awardCaseFee(caseData, run())).toMatchObject({
      fee: 350,
      alreadyAwarded: true,
      wallet: { balance: 450 },
    });
    expect(
      wallet.purchaseHint(caseData, run("active", "playing"), hint()),
    ).toMatchObject({ charged: 40, wallet: { balance: 410 } });
  });

  it("rejects corrupted receipt amounts instead of coercing strings into currency", async () => {
    const wallet = await import("./wallet");
    wallet.awardCaseFee(caseData, run());
    const saved = JSON.parse(storage.get("cd.wallet")!);
    saved.receipts[0].amount = "350";
    storage.set("cd.wallet", JSON.stringify(saved));
    vi.resetModules();
    const fresh = await import("./wallet");
    expect(fresh.getWallet()).toMatchObject({ balance: 100, history: [] });
  });

  it("keeps session changes after storage runs out of space and returns independent snapshots", async () => {
    const wallet = await import("./wallet");
    wallet.awardCaseFee(caseData, run());
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem() {
        throw new Error("quota");
      },
    });
    wallet.purchaseHint(caseData, run("active", "playing"), hint());
    const snapshot = wallet.getWallet();
    snapshot.balance = 999;
    snapshot.history.length = 0;
    expect(wallet.getWallet()).toMatchObject({ balance: 410 });
    expect(wallet.getWallet().history).toHaveLength(2);
  });
});

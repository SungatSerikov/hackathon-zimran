import { describe, expect, it } from "vitest";
import type { Accusation } from "../types";
import { evaluateVerdict } from "./verdict";
import { makeCase } from "./test-fixtures";

const accusation: Accusation = {
  verdict: "GUILTY",
  culprit: "owner",
  method: "duplicate",
  evidence: ["payment", "invoice"],
};

describe("evaluateVerdict", () => {
  it("accepts the correct verdict, culprit, method, and two distinct supporting documents", () => {
    expect(evaluateVerdict(makeCase(), accusation)).toBe(true);
  });
  it.each([
    { verdict: "NOT_GUILTY" },
    { culprit: "client" },
    { method: "bank" },
    { evidence: ["payment", "payment"] },
    { evidence: ["payment", "start"] },
    { evidence: ["payment"] },
    { evidence: ["payment", "invoice", "start"] },
  ])("rejects incomplete or mismatched accusation %j", (change) => {
    expect(
      evaluateVerdict(makeCase(), { ...accusation, ...change } as Accusation),
    ).toBe(false);
  });
  it("allows any two required clues when a case lists more than two", () => {
    const data = makeCase();
    data.solution.requiredEvidence.push("lead");
    expect(
      evaluateVerdict(data, { ...accusation, evidence: ["lead", "invoice"] }),
    ).toBe(true);
  });
});

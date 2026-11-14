import { describe, expect, it } from "vitest";
import { validateCase } from "./validate";
import { makeCase, note } from "./test-fixtures";

describe("validateCase", () => {
  it("finds the shortest full query path to two clues, including parallel branches", () => {
    const report = validateCase(makeCase());
    expect(report.valid).toBe(true);
    expect(report.minimumSearches).toBe(3);
    expect(report.solutionPath).toEqual([
      "Arbor Repairs",
      "5550104471",
      "AB901",
    ]);
    expect(report.reachableDocumentIds).toEqual([
      "start",
      "lead",
      "payment",
      "invoice",
    ]);
  });
  it("accounts for a single query revealing both clues across multiple entries", () => {
    const data = makeCase();
    data.searchIndex[2].keys = ["5550104471"];
    data.searchIndex[2].kind = "phone";
    expect(validateCase(data).minimumSearches).toBe(2);
  });
  it("counts a shared one-letter typo that opens two visible search entries together", () => {
    const data = makeCase();
    data.brief = "Follow ABCD11 and ABCD22.";
    data.documents = [
      note("start", "Read the brief.", true),
      note("payment", "First evidence."),
      note("invoice", "Second evidence."),
    ];
    data.searchIndex = [
      { id: "one", kind: "order", keys: ["ABCD11"], reveals: ["payment"] },
      { id: "two", kind: "order", keys: ["ABCD22"], reveals: ["invoice"] },
    ];
    const report = validateCase(data);
    expect(report.minimumSearches).toBe(1);
    expect(report.solutionPath).toHaveLength(1);
  });
  it("solves using any two required evidence but checks reachability of every required clue", () => {
    const data = makeCase();
    data.solution.requiredEvidence = ["start", "lead", "payment"];
    expect(validateCase(data).minimumSearches).toBe(1);
    data.documents.push(note("unreachable", "No incoming link."));
    data.solution.requiredEvidence.push("unreachable");
    expect(validateCase(data).valid).toBe(false);
  });
  it("warns about unavailable entries and rejects fewer than 80 percent reachable documents", () => {
    const data = makeCase();
    data.documents.push(note("lost", "Nothing useful."));
    data.searchIndex.push({
      id: "lost-entry",
      keys: ["unseen-key"],
      kind: "other",
      reveals: ["lost"],
    });
    const report = validateCase(data);
    expect(report.valid).toBe(true);
    expect(report.warnings.join(" ")).toContain("lost-entry");
    data.documents.push(note("lost-too", "Nothing useful either."));
    expect(validateCase(data).valid).toBe(false);
  });
  it("uses the same boundaries and phone normalization as live search", () => {
    const data = makeCase();
    data.searchIndex[0].keys = ["Ann"];
    data.brief = "The annual report.";
    expect(validateCase(data).valid).toBe(false);
  });
  it.each([
    null,
    undefined,
    12,
    [],
    {},
    { documents: [null], solution: null },
    { characters: "wrong" },
  ])("reports malformed unknown input without throwing: %j", (input) => {
    const report = validateCase(input);
    expect(report.valid).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
  });
  it.each([
    [
      "characters[1].id",
      (data: ReturnType<typeof makeCase>) => {
        data.characters[1].id = "client";
      },
    ],
    [
      "documents[1].id",
      (data: ReturnType<typeof makeCase>) => {
        data.documents[1].id = "start";
      },
    ],
    [
      "searchIndex[0].reveals",
      (data: ReturnType<typeof makeCase>) => {
        data.searchIndex[0].reveals = ["missing"];
      },
    ],
    [
      "solution.culprit",
      (data: ReturnType<typeof makeCase>) => {
        data.solution.culprit = "missing";
      },
    ],
    [
      "solution.correctMethod",
      (data: ReturnType<typeof makeCase>) => {
        data.solution.correctMethod = "missing";
      },
    ],
    [
      "solution.methods",
      (data: ReturnType<typeof makeCase>) => {
        data.solution.methods.pop();
      },
    ],
    [
      "solution.requiredEvidence",
      (data: ReturnType<typeof makeCase>) => {
        data.solution.requiredEvidence = ["payment", "payment"];
      },
    ],
    [
      "claim",
      (data: ReturnType<typeof makeCase>) => {
        data.claim = " ";
      },
    ],
    [
      "documents[0].body.body",
      (data: ReturnType<typeof makeCase>) => {
        data.documents[0].body = {};
      },
    ],
  ])("reports an actionable path for invalid %s", (path, change) => {
    const data = makeCase();
    change(data);
    const report = validateCase(data);
    expect(report.valid).toBe(false);
    expect(report.errors.join(" ")).toContain(path);
  });
  it("validates type-specific document fields rather than accepting any body object", () => {
    const data = makeCase();
    data.documents[0].type = "receipt";
    data.documents[0].body = {
      vendor: "Shop",
      number: "A",
      date: "11/14/2026",
      items: [{ name: "Repair", amount: NaN }],
      total: 100,
      paymentMethod: "card",
    };
    expect(validateCase(data).errors.join(" ")).toContain(
      "documents[0].body.items[0].amount",
    );
  });
  describe.each(["gameDate", "worldDate"])("%s", (field) => {
    it.each([
      null,
      {},
      20261114,
      "2026-11-14",
      "13/01/2026",
      "04/31/2026",
      "02/29/2026",
      "02/29/1900",
      "01/00/2026",
      "11/14/0000",
    ])("rejects an invalid optional calendar date: %j", (value) => {
      const report = validateCase({ ...makeCase(), [field]: value });
      expect(report.valid).toBe(false);
      expect(report.errors.join(" ")).toContain(field);
    });
    it.each(["11/14/2026", "02/29/2024", "02/29/2000"])(
      "accepts a real MM/DD/YYYY calendar date: %s",
      (value) => {
        expect(validateCase({ ...makeCase(), [field]: value }).valid).toBe(
          true,
        );
      },
    );
  });
  it.each([
    { value: null },
    { value: { note: "Do not render this object." } },
    { value: ["A note"] },
    { value: 42 },
  ])("rejects malformed optional receipt notes: %j", ({ value }) => {
    const data = makeCase();
    const receipt = {
      ...data.documents[0],
      type: "receipt",
      body: {
        vendor: "Shop",
        number: "A",
        date: "11/14/2026",
        items: [{ name: "Repair", amount: 100 }],
        total: 100,
        paymentMethod: "card",
        body: value,
      },
    };
    const report = validateCase({
      ...data,
      documents: [receipt, ...data.documents.slice(1)],
    });
    expect(report.valid).toBe(false);
    expect(report.errors.join(" ")).toContain("documents[0].body.body");
  });
  it("accepts receipt notes when present as text", () => {
    const data = makeCase();
    data.documents[0] = {
      ...data.documents[0],
      type: "receipt",
      body: {
        vendor: "Shop",
        number: "A",
        date: "11/14/2026",
        items: [{ name: "Repair", amount: 100 }],
        total: 100,
        paymentMethod: "card",
        body: "Payment recorded in full.",
      },
    };
    expect(validateCase(data).valid).toBe(true);
  });
});

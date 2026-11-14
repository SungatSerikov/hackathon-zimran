import { describe, expect, it } from "vitest";
import { cases, getCase } from "./index";
import { searchCase } from "../engine/search";
import { validateCase } from "../engine/validate";
import { evaluateVerdict } from "../engine/verdict";

function visibleStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(visibleStrings);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(visibleStrings);
  return [];
}

const walkthroughs = [
  {
    id: "tutorial-double-charge",
    minimumSearches: 2,
    queries: ["FixRight Plumbing", "Riverton Savings", "FXR Services LLC"],
    evidence: ["d_registry", "d_bank_letter"],
    unsupportedPair: ["d_ad", "d_bank"],
  },
  {
    id: "case-01-missing-refund",
    minimumSearches: 3,
    queries: [
      "PG-77310452",
      "880 Industrial Way",
      "QuickShip Returns LLC",
      "northwind-returnshelp.example",
    ],
    evidence: ["d_registry", "d_whois"],
    unsupportedPair: ["d_tracking", "d_unit_listing"],
  },
];

describe("published case content", () => {
  it.each(walkthroughs)(
    "$id has a reachable solution and a fair evidence requirement",
    ({ id, minimumSearches, queries, evidence, unsupportedPair }) => {
      const data = getCase(id)!;
      expect(data).toBeDefined();
      const report = validateCase(data);
      expect(report.errors).toEqual([]);
      expect(report.warnings).toEqual([]);
      expect(report.valid).toBe(true);
      expect(report.minimumSearches).toBe(minimumSearches);
      expect(report.reachableDocumentIds).toHaveLength(data.documents.length);
      expect(data.solution.requiredEvidence).toEqual(evidence);

      let opened = data.documents
        .filter((document) => document.initial)
        .map((document) => document.id);
      for (const query of queries) {
        const result = searchCase(data, opened, query);
        expect(
          result.newDocumentIds.length,
          `Expected new records for visible clue ${query}`,
        ).toBeGreaterThan(0);
        opened = [...new Set([...opened, ...result.newDocumentIds])];
      }
      expect(opened).toEqual(expect.arrayContaining(evidence));
      const answer = {
        verdict: data.solution.verdict,
        culprit: data.solution.culprit,
        method: data.solution.correctMethod,
        evidence,
      };
      expect(evaluateVerdict(data, answer)).toBe(true);
      expect(
        evaluateVerdict(data, { ...answer, evidence: unsupportedPair }),
      ).toBe(false);
    },
  );

  it("keeps all visible document fields in the search text", () => {
    for (const data of cases) {
      for (const document of data.documents) {
        expect(document.text, document.id).toContain(document.title);
        for (const value of visibleStrings(document.body)) {
          expect(document.text, `${data.id}/${document.id}`).toContain(value);
        }
      }
    }
  });

  it("has no clues hidden only in flat search text", () => {
    for (const data of cases) {
      const renderedCase = {
        ...data,
        documents: data.documents.map((document) => ({
          ...document,
          text: [document.title, ...visibleStrings(document.body)].join("\n"),
        })),
      };
      const original = validateCase(data);
      const rendered = validateCase(renderedCase);
      expect(rendered.valid, data.id).toBe(true);
      expect(rendered.minimumSearches, data.id).toBe(original.minimumSearches);
      expect(rendered.reachableDocumentIds, data.id).toEqual(
        original.reachableDocumentIds,
      );
    }
  });

  it("blocks undiscovered company shortcuts but accepts the visible support-email domain", () => {
    const main = getCase("case-01-missing-refund")!;
    const opened = main.documents
      .filter((document) => document.initial)
      .map((document) => document.id);
    expect(
      searchCase(main, opened, "QuickShip Returns LLC").documentIds,
    ).toEqual([]);
    expect(
      searchCase(main, opened, "northwind-returnshelp.example").documentIds,
    ).toEqual(["d_whois"]);
  });
});

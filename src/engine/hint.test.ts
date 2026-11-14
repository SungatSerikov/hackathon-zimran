import { describe, expect, it } from "vitest";
import { cases } from "../cases";
import { getNextHint, type HintOffer } from "./hint";
import { clueOccurs, searchCase } from "./search";
import { makeCase, note } from "./test-fixtures";
import { validateCase } from "./validate";

describe("getNextHint", () => {
  it("first points to the clue type and an opened source without giving the query", () => {
    const offer = getNextHint(makeCase(), ["start"], [], []);
    expect(offer.level).toBe(1);
    expect(offer.free).toBe(false);
    expect(offer.query).toBeUndefined();
    expect(offer.message).toContain("company name");
    expect(offer.message).toContain("start");
    expect(offer.message).not.toContain("Arbor Repairs");
    expect(offer.message).not.toContain("lead");
  });
  it("reveals the query on the second call and repeats that advice for free", () => {
    const data = makeCase();
    const first = getNextHint(data, ["start"], [], []);
    const second = getNextHint(data, ["start"], ["wrong query"], [first]);
    expect(second).toMatchObject({
      stepKey: first.stepKey,
      level: 2,
      query: "Arbor Repairs",
      free: false,
    });
    const repeat = getNextHint(data, ["start"], [], [first, second]);
    expect(repeat).toMatchObject({
      stepKey: first.stepKey,
      level: 2,
      query: "Arbor Repairs",
      free: true,
    });
  });
  it("starts a new hint level after the suggested search actually opens documents", () => {
    const data = makeCase();
    const first = getNextHint(data, ["start"], [], []);
    const second = getNextHint(data, ["start"], [], [first]);
    const next = getNextHint(
      data,
      ["start", "lead"],
      ["Arbor Repairs"],
      [first, second],
    );
    expect(next.level).toBe(1);
    expect(next.stepKey).not.toBe(first.stepKey);
    expect(next.message).toContain("phone number");
    expect(next.message).toContain("lead");
  });
  it("replans from the current folder and retries a query that previously failed while locked", () => {
    const data = makeCase();
    const opened = ["start", "lead", "payment"];
    const queries = ["AB901", "Arbor Repairs", "5550104471", "nothing"];
    const first = getNextHint(data, opened, queries, []);
    const second = getNextHint(data, opened, queries, [first]);
    expect(second.query).toBe("AB901");
    expect(searchCase(data, opened, second.query!).newDocumentIds).toEqual([
      "invoice",
    ]);
  });
  it("offers the visible alias rather than an unrevealed primary key", () => {
    const data = makeCase();
    data.brief = "Investigate Known Alias.";
    data.documents[0] = note("start", "Read the case brief.", true);
    data.searchIndex[0].keys = ["Secret Holding Company", "Known Alias"];
    const first = getNextHint(data, ["start"], [], []);
    expect(first.message).toContain("case brief");
    expect(first.message).not.toContain("Secret Holding Company");
    const second = getNextHint(data, ["start"], [], [first]);
    expect(second.query).toBe("Known Alias");
  });
  it("avoids giving the exact query when it appears in the source title", () => {
    const data = makeCase();
    data.brief = "Investigate the documents.";
    data.documents[0].title = "Arbor Repairs receipt";
    const first = getNextHint(data, ["start"], [], []);
    expect(first.level).toBe(1);
    expect(first.message).not.toContain("Arbor Repairs");
  });
  it("makes verdict guidance free once two distinct required clues are open", () => {
    const offer = getNextHint(makeCase(), ["payment", "invoice"], [], []);
    expect(offer).toMatchObject({ level: 0, free: true });
    expect(offer.query).toBeUndefined();
    expect(offer.message).toContain("Pin");
    expect(offer.message).toContain("stamp");
    expect(
      getNextHint(makeCase(), ["payment", "payment", "start"], [], []).level,
    ).toBe(1);
  });
  it("does not sell a hint when there is no reachable next step", () => {
    const data = makeCase();
    data.searchIndex = [];
    const offer = getNextHint(data, ["start"], [], []);
    expect(offer).toMatchObject({ level: 0, free: true });
    expect(offer.message).not.toContain("enough");
  });
  it("uses the same optimal shared-typo action as the validator", () => {
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
    const first = getNextHint(data, ["start"], [], []);
    const second = getNextHint(data, ["start"], [], [first]);
    expect(second.query).toEqual(expect.any(String));
    expect(searchCase(data, ["start"], second.query!).newDocumentIds).toEqual([
      "payment",
      "invoice",
    ]);
    expect(validateCase(data).minimumSearches).toBe(1);
  });
  it.each(cases)(
    "walks $id to two supporting documents without suggesting locked records",
    (data) => {
      let opened = data.documents
        .filter((document) => document.initial)
        .map((document) => document.id);
      const queries: string[] = [];
      const history: HintOffer[] = [];
      for (let attempt = 0; attempt < data.documents.length; attempt++) {
        const nudge = getNextHint(data, opened, queries, history);
        if (nudge.level === 0) break;
        expect(nudge.level).toBe(1);
        history.push(nudge);
        const exact = getNextHint(data, opened, queries, history);
        expect(exact.level).toBe(2);
        history.push(exact);
        const result = searchCase(data, opened, exact.query!);
        expect(result.newDocumentIds.length).toBeGreaterThan(0);
        const visible = [
          data.brief,
          ...data.documents
            .filter((document) => opened.includes(document.id))
            .map((document) => document.text),
        ];
        for (const id of result.matchedEntryIds) {
          const entry = data.searchIndex.find(
            (candidate) => candidate.id === id,
          )!;
          expect(
            entry.keys.some((key) =>
              visible.some((text) => clueOccurs(text, key, entry.kind)),
            ),
          ).toBe(true);
        }
        queries.push(exact.query!);
        opened = [...new Set([...opened, ...result.newDocumentIds])];
      }
      expect(
        data.solution.requiredEvidence.filter((id) => opened.includes(id))
          .length,
      ).toBeGreaterThanOrEqual(2);
      expect(queries.length).toBe(validateCase(data).minimumSearches);
      expect(getNextHint(data, opened, queries, history)).toMatchObject({
        level: 0,
        free: true,
      });
    },
  );
});

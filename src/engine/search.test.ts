import { describe, expect, it } from "vitest";
import { searchCase } from "./search";
import { makeCase, note } from "./test-fixtures";

describe("searchCase", () => {
  it("reveals a visible clue and identifies repeated results", () => {
    const data = makeCase();
    expect(searchCase(data, ["start"], " ARBOR, Repairs! ")).toEqual({
      documentIds: ["lead"],
      newDocumentIds: ["lead"],
      matchedEntryIds: ["company"],
    });
    expect(
      searchCase(data, ["start", "lead"], "arbor repairs").newDocumentIds,
    ).toEqual([]);
  });
  it("refuses a correct key until its clue has been opened", () => {
    const data = makeCase();
    expect(searchCase(data, ["start"], "5550104471").documentIds).toEqual([]);
    expect(
      searchCase(data, ["start", "lead"], "(555) 010-4471").documentIds,
    ).toEqual(["payment"]);
    expect(
      searchCase(data, ["start", "lead"], "#AB - 901").documentIds,
    ).toEqual(["invoice"]);
  });
  it("accepts one edit for long keys but not transposition or two edits", () => {
    const data = makeCase();
    for (const query of ["arbor repair", "arbor repairss", "arbor repaixs"]) {
      expect(searchCase(data, ["start"], query).documentIds).toEqual(["lead"]);
    }
    expect(searchCase(data, ["start"], "arbor repiars").documentIds).toEqual(
      [],
    );
    expect(searchCase(data, ["start"], "arbor rexxirs").documentIds).toEqual(
      [],
    );
    expect(searchCase(data, ["start", "lead"], "AB902").documentIds).toEqual(
      [],
    );
  });
  it("accepts a discovered alias but rejects accidental substrings", () => {
    const data = makeCase();
    data.brief = "The annual report concerns Arbor Repairs.";
    data.searchIndex[0].keys = ["Ann", "Arbor Repairs"];
    expect(searchCase(data, [], "Ann").documentIds).toEqual(["lead"]);
    data.searchIndex[0].keys = ["Ann"];
    expect(searchCase(data, [], "Ann").documentIds).toEqual([]);
  });
  it("does not create a phone clue by concatenating unrelated numbers", () => {
    const data = makeCase();
    data.brief = "555 people paid 010 dollars for 4471 items.";
    expect(searchCase(data, [], "5550104471").documentIds).toEqual([]);
    data.brief = "Call 15550104471.";
    expect(searchCase(data, [], "5550104471").documentIds).toEqual([]);
  });
  it("requires an exact discovered clue even when query typo is accepted", () => {
    const data = makeCase();
    data.brief = "Arbor Repairx";
    data.documents = [
      note("start", "No clue here.", true),
      ...data.documents.slice(1),
    ];
    expect(searchCase(data, ["start"], "Arbor Repairs").documentIds).toEqual(
      [],
    );
  });
  it("recognizes a complete domain inside an email address without losing punctuation boundaries", () => {
    const data = makeCase();
    data.brief = "A message arrived from support@arbor-repairs.com.";
    data.searchIndex[0].keys = ["arbor-repairs.com"];
    data.searchIndex[0].kind = "other";
    expect(searchCase(data, [], "arbor-repairs.com").documentIds).toEqual([
      "lead",
    ]);
  });
  it("deduplicates documents shared by matching entries and ignores empty queries", () => {
    const data = makeCase();
    data.searchIndex.push({
      id: "duplicate",
      kind: "company",
      keys: ["Arbor Repairs"],
      reveals: ["lead"],
    });
    expect(searchCase(data, ["start"], "Arbor Repairs").documentIds).toEqual([
      "lead",
    ]);
    expect(searchCase(data, ["start"], "?!").documentIds).toEqual([]);
  });
});

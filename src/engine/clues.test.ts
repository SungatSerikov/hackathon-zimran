import { describe, expect, it } from "vitest";
import { getDocumentClues, splitClueText, findReusableSearch } from "./clues";
import { findClueMatches, searchCase } from "./search";
import { makeCase, note } from "./test-fixtures";

describe("visible document clues", () => {
  it("offers only details rendered in this document, without hidden aliases or flat-text leaks", () => {
    const data = makeCase();
    data.searchIndex[0].keys.unshift("Secret owner account");
    const source = note("source", "Arbor Repairs.", true);
    source.text += " Secret owner account. 5550104471. AB901.";
    source.body.vendor = "5550104471"; // notes do not render the vendor field
    expect(getDocumentClues(source, data.searchIndex)).toEqual([
      { entryId: "company", kind: "company", query: "Arbor Repairs" },
    ]);
  });

  it("preserves the readable spelling of phone and reference clues", () => {
    const data = makeCase();
    expect(getDocumentClues(data.documents[1], data.searchIndex)).toEqual([
      { entryId: "phone", kind: "phone", query: "(555) 010-4471" },
      { entryId: "order", kind: "order", query: "AB-901" },
    ]);
  });

  it("offers one readable alias per entry and deduplicates shared clues", () => {
    const data = makeCase();
    data.searchIndex[0].keys.push("Arbor");
    data.searchIndex.push({ ...data.searchIndex[0], id: "same-company" });
    expect(getDocumentClues(data.documents[0], data.searchIndex)).toHaveLength(1);
    expect(getDocumentClues(data.documents[0], data.searchIndex)[0].query).toBe("Arbor Repairs");
  });

  it("does not manufacture clues across fields or in unseen documents", () => {
    const data = makeCase();
    const source = note("source", "Repairs", true);
    source.title = "Arbor";
    expect(getDocumentClues(source, data.searchIndex)).toEqual([]);
    expect(getDocumentClues(data.documents[0], data.searchIndex).some(c => c.entryId === "phone")).toBe(false);
  });

  it("finds a domain inside a rendered email address", () => {
    const index = [{ id: "site", kind: "other" as const, keys: ["returns.example"], reveals: ["lookup"] }];
    const doc = { ...note("mail", ""), type: "email" as const,
      body: { from: "help@returns.example", to: "Amy", subject: "Return", date: "10/12/2026", body: "Thank you." } };
    expect(getDocumentClues(doc, index)[0].query).toBe("returns.example");
  });
});

describe("inline clue ranges", () => {
  it("retains complete boundaries and every source character", () => {
    const text = "An annual report for Ann. Ann replied.";
    const clue = { entryId: "ann", kind: "name" as const, query: "Ann" };
    const parts = splitClueText(text, [clue]);
    expect(parts.map(p => p.text).join("")).toBe(text);
    expect(parts.filter(p => p.clue).map(p => p.text)).toEqual(["Ann", "Ann"]);
    expect(findClueMatches("15550104471", "5550104471", "phone")).toEqual([]);
  });

  it("uses the longest overlapping match without losing surrounding punctuation", () => {
    const text = "Check Arbor Repairs, then Arbor.";
    const parts = splitClueText(text, [
      { entryId: "short", kind: "company", query: "Arbor" },
      { entryId: "long", kind: "company", query: "Arbor Repairs" },
    ]);
    expect(parts.map(p => p.text).join("")).toBe(text);
    expect(parts.filter(p => p.clue).map(p => p.clue?.query)).toEqual(["Arbor Repairs", "Arbor"]);
  });

  it("keeps formatted phone and tracking tokens usable as queries", () => {
    const text = "Call (555) 010-4471 about #AB - 901.";
    expect(findClueMatches(text, "5550104471", "phone").map(r => text.slice(r.start, r.end))).toEqual(["(555) 010-4471"]);
    expect(findClueMatches(text, "AB901", "order").map(r => text.slice(r.start, r.end))).toEqual(["AB - 901"]);
  });
});

describe("reopening a search", () => {
  it("reuses equivalent already-found results without adding a search", () => {
    const data = makeCase();
    const queries = [{ query: "Arbor Repairs", documentIds: ["lead"], newCount: 1 }];
    expect(findReusableSearch(data, ["start", "lead"], queries, "ARBOR, Repairs!")).toBe(0);
    expect(queries).toHaveLength(1);
  });

  it("does not reuse a failed search after a newly opened document unlocks it", () => {
    const data = makeCase();
    const queries = [{ query: "5550104471", documentIds: [], newCount: 0 }];
    expect(findReusableSearch(data, ["start"], queries, "5550104471")).toBe(0);
    expect(findReusableSearch(data, ["start", "lead"], queries, "5550104471")).toBe(-1);
    expect(searchCase(data, ["start", "lead"], "5550104471").documentIds).toEqual(["payment"]);
  });

  it("does not reuse partial results when another entry becomes available", () => {
    const data = makeCase();
    data.searchIndex.push({ id: "extra", keys: ["Arbor Repairs", "Extra Reference"], kind: "company", reveals: ["invoice"] });
    const queries = [{ query: "Arbor Repairs", documentIds: ["lead"], newCount: 1 }];
    expect(findReusableSearch(data, ["start", "lead"], queries, "Arbor Repairs")).toBe(-1);
  });

  it("does not reuse unrelated queries or mutate history", () => {
    const data = makeCase();
    const queries = [{ query: "nothing", documentIds: [], newCount: 0 }];
    expect(findReusableSearch(data, ["start"], queries, "another query")).toBe(-1);
    expect(findReusableSearch(data, ["start"], queries, " ")).toBe(-1);
    expect(queries[0].query).toBe("nothing");
  });
});

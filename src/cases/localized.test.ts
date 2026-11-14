import { describe, expect, it } from "vitest";
import { cases } from "./index";
import { getLocalizedCase, getLocalizedCases } from "./localized";
import { getDocumentClues, findReusableSearch } from "../engine/clues";
import { isEntryAvailable, searchCase } from "../engine/search";
import { validateCase } from "../engine/validate";
import { evaluateVerdict } from "../engine/verdict";
import type { CaseData } from "../types";
import type { Language } from "../i18n/language";

function visibleStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(visibleStrings);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(visibleStrings);
  return [];
}

function initialIds(data: CaseData): string[] {
  return data.documents.filter((document) => document.initial).map((document) => document.id);
}

describe("localized case content", () => {
  it("keeps stable case objects for both languages and handles unknown IDs", () => {
    for (const language of ["en", "ru"] as const) {
      expect(getLocalizedCases(language)).toBe(getLocalizedCases(language));
      expect(getLocalizedCases(language).map((data) => data.id)).toEqual(cases.map((data) => data.id));
      for (const data of getLocalizedCases(language))
        expect(getLocalizedCase(data.id, language)).toBe(data);
      expect(getLocalizedCase("missing-case", language)).toBeUndefined();
    }
    expect(getLocalizedCases("ru")[0].title).toBe("Двойное списание");
    expect(getLocalizedCases("ru")[1].title).toBe("Пропавший возврат");
  });

  it.each(["en", "ru"] as const)("validates every %s case with all documents reachable and unchanged search costs", (language) => {
    for (const data of getLocalizedCases(language)) {
      const report = validateCase(data);
      expect(report.errors, data.id).toEqual([]);
      expect(report.warnings, data.id).toEqual([]);
      expect(report.valid, data.id).toBe(true);
      expect(report.reachableDocumentIds, data.id).toHaveLength(data.documents.length);
      expect(report.minimumSearches, data.id).toBe(data.id === "tutorial-double-charge" ? 2 : 3);
    }
  });

  it("preserves every game identifier, numeric value, date, URL, and solution", () => {
    for (const original of cases) {
      const russian = getLocalizedCase(original.id, "ru")!;
      expect([russian.difficulty, russian.estMinutes, russian.premium, russian.gameDate, russian.worldDate])
        .toEqual([original.difficulty, original.estMinutes, original.premium, original.gameDate, original.worldDate]);
      expect([russian.claim.number, russian.claim.claimant, russian.claim.respondent, russian.claim.amount])
        .toEqual([original.claim.number, original.claim.claimant, original.claim.respondent, original.claim.amount]);
      expect(russian.characters.map(({ id, portrait }) => ({ id, portrait })))
        .toEqual(original.characters.map(({ id, portrait }) => ({ id, portrait })));
      expect(russian.searchIndex.map(({ id, kind, reveals }) => ({ id, kind, reveals })))
        .toEqual(original.searchIndex.map(({ id, kind, reveals }) => ({ id, kind, reveals })));
      expect({ ...russian.solution, methods: russian.solution.methods.map(({ id }) => id), explanation: undefined })
        .toEqual({ ...original.solution, methods: original.solution.methods.map(({ id }) => id), explanation: undefined });
      for (const document of original.documents) {
        const translated = russian.documents.find(({ id }) => id === document.id)!;
        expect([translated.id, translated.type, translated.initial, translated.body.number, translated.body.date, translated.body.total])
          .toEqual([document.id, document.type, document.initial, document.body.number, document.body.date, document.body.total]);
        expect(translated.body.items?.map(({ amount }) => amount)).toEqual(document.body.items?.map(({ amount }) => amount));
        expect(translated.body.rows?.map(({ date, amount }) => ({ date, amount }))).toEqual(document.body.rows?.map(({ date, amount }) => ({ date, amount })));
        expect(translated.body.messages?.map(({ time }) => time)).toEqual(document.body.messages?.map(({ time }) => time));
        expect(translated.body.phone).toBe(document.body.phone);
        const printedNumbers = (value: unknown) =>
          (visibleStrings(value).join("\n").match(/\d+(?:[./:-]\d+)*/g) ?? []).sort();
        expect(printedNumbers([translated.title, translated.body]), `${original.id}/${document.id}`)
          .toEqual(printedNumbers([document.title, document.body]));
        const identifiers = visibleStrings(document.body).join("\n").match(/[\w@./-]+\.example(?:\/[\w/-]*)?|\b(?:\d{2}\/\d{2}\/\d{4}|(?:NW|PG|SC)-[\d-]+)\b|\$\d+(?:\.\d+)?/g) ?? [];
        for (const identifier of identifiers) expect(translated.text, `${original.id}/${document.id}`).toContain(identifier);
      }
    }
  });

  it("builds Russian search text from precisely the visible title and body strings", () => {
    for (const data of getLocalizedCases("ru")) {
      for (const document of data.documents) {
        expect(document.text, `${data.id}/${document.id}`).toBe([document.title, ...visibleStrings(document.body)].join("\n"));
        expect(document.title, document.id).toMatch(/[А-Яа-яЁё]/);
        for (const clue of getDocumentClues(document, data.searchIndex)) {
          expect(searchCase(data, [document.id], clue.query).documentIds, `${document.id}: ${clue.query}`)
            .toEqual(expect.arrayContaining(data.searchIndex.find(({ id }) => id === clue.entryId)!.reveals));
        }
      }
    }
  });

  it.each(["en", "ru"] as const)("accepts Russian and English aliases in %s without exposing locked records", (language) => {
    for (const data of getLocalizedCases(language)) {
      const opened = initialIds(data);
      for (const entry of data.searchIndex) {
        const available = isEntryAvailable(data, new Set(opened), entry);
        for (const query of entry.keys) {
          expect(searchCase(data, opened, query).matchedEntryIds.includes(entry.id), `${data.id}: ${query}`)
            .toBe(available);
        }
      }
      const allIds = data.documents.map(({ id }) => id);
      for (const entry of data.searchIndex)
        for (const query of entry.keys)
          expect(searchCase(data, allIds, query).documentIds, query).toEqual(expect.arrayContaining(entry.reveals));
    }
    const main = getLocalizedCase("case-01-missing-refund", language)!;
    const opened = initialIds(main);
    for (const query of ["КвикШип", "QuickShip Returns LLC", "Кайл Дентон", "Kyle Denton", "Рэй Ортис", "Ray Ortiz", "9375550142"])
      expect(searchCase(main, opened, query).documentIds, query).toEqual([]);
    for (const query of ["Глория Мендес", "Gloria Mendez"])
      expect(searchCase(main, opened, query).documentIds).toEqual(["d_forum"]);
    for (const query of ["880 Индастриал-уэй", "880 Industrial Way"])
      expect(searchCase(main, opened, query).documentIds).toEqual(["d_unit_listing"]);
    const tutorial = getLocalizedCase("tutorial-double-charge", language)!;
    for (const query of ["Ривертон Сейвингс", "Riverton Savings"])
      expect(searchCase(tutorial, initialIds(tutorial), query).documentIds).toEqual(["d_bank_letter"]);
  });

  it("preserves discovered records, reusable queries, and verdicts when switching language", () => {
    for (const original of cases) {
      let language: Language = "en";
      let data = getLocalizedCase(original.id, language)!;
      let opened = initialIds(data);
      const queries = original.id === "tutorial-double-charge"
        ? ["Riverton Savings", "FXR Services LLC"]
        : ["880 Industrial Way", "КвикШип", "northwind-returnshelp.example"];
      const history: { query: string; documentIds: string[] }[] = [];
      for (const query of queries) {
        data = getLocalizedCase(original.id, language)!;
        const result = searchCase(data, opened, query);
        expect(result.newDocumentIds.length, query).toBeGreaterThan(0);
        history.push({ query, documentIds: result.documentIds });
        opened = [...new Set([...opened, ...result.newDocumentIds])];
        language = language === "en" ? "ru" : "en";
      }
      data = getLocalizedCase(original.id, "ru")!;
      const equivalent = original.id === "tutorial-double-charge" ? "Ривертон Сейвингс" : "880 Индастриал-уэй";
      expect(findReusableSearch(data, opened, history, equivalent)).toBe(0);
      expect(opened).toEqual(expect.arrayContaining(data.solution.requiredEvidence));
      expect(evaluateVerdict(data, {
        verdict: original.solution.verdict,
        culprit: original.solution.culprit,
        method: original.solution.correctMethod,
        evidence: original.solution.requiredEvidence,
      })).toBe(true);
    }
  });

  it("prefers the current language aliases and leaves original English content untouched", () => {
    const russian = getLocalizedCase("case-01-missing-refund", "ru")!;
    const english = getLocalizedCase("case-01-missing-refund", "en")!;
    expect(russian.searchIndex.find(({ id }) => id === "s_gloria")!.keys[0]).toBe("Глория Мендес");
    expect(english.searchIndex.find(({ id }) => id === "s_gloria")!.keys[0]).toBe("Gloria Mendez");
    expect(cases[1].searchIndex.find(({ id }) => id === "s_gloria")!.keys).toEqual(["Gloria Mendez"]);
  });
});

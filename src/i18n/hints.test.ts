import { describe, expect, it } from "vitest";
import { getLocalizedCases, getLocalizedCase } from "../cases/localized";
import { getNextHint, type HintOffer } from "../engine/hint";
import { searchCase } from "../engine/search";
import { makeCase } from "../engine/test-fixtures";
import { createRun, gameReducer } from "../store/game";
import { presentHint } from "./hints";

function bilingualCase() {
  const en = makeCase();
  en.searchIndex[0].keys.push("Мастерская");
  const ru = structuredClone(en);
  ru.brief = "Расследуйте деятельность компании Мастерская.";
  ru.documents[0].title = "Вводная записка";
  ru.documents[0].text = "Мастерская.";
  ru.searchIndex[0].keys = ["Мастерская", "Arbor Repairs"];
  return { en, ru };
}

describe("hint presentation", () => {
  it("translates an engine-generated nudge without leaking the exact search", () => {
    const { ru } = bilingualCase();
    const hint = getNextHint(ru, ["start"], [], []);
    const displayed = presentHint(hint, ru, "ru");
    expect(displayed.message).toContain("название компании");
    expect(displayed.message).toContain("Вводная записка");
    expect(displayed.message).not.toContain("Check the");
    expect(displayed.message).not.toContain("Мастерская");
    expect(displayed.query).toBeUndefined();
  });

  it("makes saved English and Russian exact hints search using the current visible alias", () => {
    const { en, ru } = bilingualCase();
    for (const [source, current, language, alias] of [
      [en, ru, "ru", "Мастерская"],
      [ru, en, "en", "Arbor Repairs"],
    ] as const) {
      const nudge = getNextHint(source, ["start"], [], []);
      const exact = getNextHint(source, ["start"], [], [nudge]);
      const saved = JSON.parse(JSON.stringify(exact));
      const displayed = presentHint(saved, current, language);
      expect(displayed.query).toBe(alias);
      expect(displayed.message).toContain(alias);
      expect(searchCase(current, ["start"], displayed.query!).newDocumentIds).toEqual(["lead"]);
      expect(saved).toEqual(exact);
    }
  });

  it("keeps retry guidance with the localized query", () => {
    const { en, ru } = bilingualCase();
    const first = getNextHint(en, ["start"], [], []);
    const exact = getNextHint(en, ["start"], ["Arbor Repairs"], [first]);
    const displayed = presentHint(exact, ru, "ru");
    expect(displayed.message).toContain("Повторите поиск");
    expect(displayed.message).toContain("Мастерская");
    expect(displayed.message).not.toContain("Arbor Repairs");
  });

  it("does not replace a saved query with an alias hidden in an unopened document", () => {
    const { en, ru } = bilingualCase();
    ru.searchIndex[0].keys.unshift("Скрытое название");
    ru.documents[1].text += " Скрытое название.";
    const first = getNextHint(en, ["start"], [], []);
    const exact = getNextHint(en, ["start"], [], [first]);
    const displayed = presentHint(exact, ru, "ru", ["start"]);
    expect(displayed.query).toBe("Мастерская");
    expect(presentHint(exact, ru, "ru").query).toBe("Мастерская");
    expect(displayed.message).not.toContain("Скрытое название");
    expect(searchCase(ru, ["start"], displayed.query!).newDocumentIds).toEqual(["lead"]);
  });

  it("does not reveal the query through a translated source title", () => {
    const { ru } = bilingualCase();
    ru.documents[0].title = "Мастерская — чек";
    const displayed = presentHint(getNextHint(ru, ["start"], [], []), ru, "ru");
    expect(displayed.message).toContain("заголовке");
    expect(displayed.message).not.toContain("Мастерская");
  });

  it("keeps a query that reveals multiple entries when no one alias replaces it", () => {
    const data = makeCase();
    data.brief = "Follow ABCD11 and ABCD22.";
    data.documents[0].text = "Read the brief.";
    data.searchIndex = [
      { id: "one", kind: "order", keys: ["ABCD11"], reveals: ["payment"] },
      { id: "two", kind: "order", keys: ["ABCD22"], reveals: ["invoice"] },
    ];
    const first = getNextHint(data, ["start"], [], []);
    const exact = getNextHint(data, ["start"], [], [first]);
    const displayed = presentHint(exact, data, "ru");
    expect(searchCase(data, ["start"], displayed.query!).newDocumentIds).toEqual(["payment", "invoice"]);
  });

  it("recovers a localized query from aliases when a legacy step key cannot be parsed", () => {
    const { en, ru } = bilingualCase();
    const first = getNextHint(en, ["start"], [], []);
    const exact = { ...getNextHint(en, ["start"], [], [first]), stepKey: "legacy-company" };
    const displayed = presentHint(exact, ru, "ru");
    expect(displayed.query).toBe("Мастерская");
    expect(exact.stepKey).toBe("legacy-company");
  });

  it("translates free verdict and no-lead guidance without inventing paid queries", () => {
    const { en, ru } = bilingualCase();
    const verdict = presentHint(getNextHint(en, ["payment", "invoice"], [], []), ru, "ru");
    expect(verdict.message).toContain("два");
    expect(verdict.message).not.toContain("You have");
    expect(verdict.query).toBeUndefined();
    const noLeadCase = { ...en, searchIndex: [] };
    const noLead = presentHint(getNextHint(noLeadCase, ["start"], [], []), ru, "ru");
    expect(noLead.message).toContain("Новых");
    expect(noLead.query).toBeUndefined();
  });

  // This integration walk repeatedly computes shortest paths for both full cases.
  // Shared CI runners can exceed Vitest's 5s default; keep the extra budget local.
  it.each(["en", "ru"] as const)("keeps every saved %s hint usable after switching language", (sourceLanguage) => {
    const language = sourceLanguage === "en" ? "ru" : "en";
    for (const source of getLocalizedCases(sourceLanguage)) {
      const current = getLocalizedCase(source.id, language)!;
      let opened = source.documents.filter((document) => document.initial).map((document) => document.id);
      const history: HintOffer[] = [];
      const queries: string[] = [];
      for (let step = 0; step < source.documents.length; step++) {
        const nudge = getNextHint(source, opened, queries, history);
        if (nudge.free) break;
        const displayedNudge = presentHint(JSON.parse(JSON.stringify(nudge)), current, language, opened);
        const title = /“(.+)”/.exec(nudge.message)?.[1];
        const sourceDocument = source.documents.find((document) => document.title === title);
        const translatedDocument = current.documents.find((document) => document.id === sourceDocument?.id);
        if (sourceDocument && translatedDocument && !translatedDocument.title.includes(sourceDocument.title)) {
          expect(displayedNudge.message).not.toContain(sourceDocument.title);
        }
        expect(displayedNudge.query).toBeUndefined();
        history.push(nudge);
        const exact = getNextHint(source, opened, queries, history);
        const displayedExact = presentHint(JSON.parse(JSON.stringify(exact)), current, language, opened);
        const originalResult = searchCase(source, opened, exact.query!);
        const localizedResult = searchCase(current, opened, displayedExact.query!);
        expect(localizedResult.newDocumentIds).toEqual(originalResult.newDocumentIds);
        expect(localizedResult.newDocumentIds.length).toBeGreaterThan(0);
        history.push(exact);
        queries.push(exact.query!);
        opened = [...new Set([...opened, ...originalResult.newDocumentIds])];
      }
      expect(current.solution.requiredEvidence.filter((id) => opened.includes(id)).length).toBeGreaterThanOrEqual(2);
    }
  }, 20_000);

  it("keeps paid steps free after displaying saved history in the other language", async () => {
    const { en, ru } = bilingualCase();
    const { purchaseHint, getWallet } = await import("../engine/wallet");
    let run = createRun(en);
    const first = getNextHint(en, run.openedIds, [], []);
    expect(purchaseHint(en, run, first).charged).toBe(40);
    run = gameReducer(run, { type: "hint", hint: first });
    const exact = getNextHint(en, run.openedIds, [], run.hints);
    expect(purchaseHint(en, run, exact).charged).toBe(40);
    run = gameReducer(run, { type: "hint", hint: exact });
    const savedRun = JSON.parse(JSON.stringify(run));
    const before = getWallet();
    savedRun.hints.forEach((hint: typeof exact) => presentHint(hint, ru, "ru"));
    const repeat = getNextHint(ru, savedRun.openedIds, [], savedRun.hints);
    expect(repeat).toMatchObject({ stepKey: exact.stepKey, level: 2, free: true });
    expect(purchaseHint(ru, savedRun, repeat)).toMatchObject({ success: true, charged: 0 });
    expect(getWallet()).toEqual(before);
    expect(savedRun).toEqual(run);
  });
});

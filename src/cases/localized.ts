import { cases } from "./index";
import tutorialRu from "./ru/tutorial.json";
import mainRu from "./ru/main.json";
import type { CaseData } from "../types";
import type { Language } from "../i18n/language";

const russianCases: CaseData[] = [tutorialRu as CaseData, mainRu as CaseData];

/** Aliases share discovery gates through their stable entry ID in both languages. */
function mergeAliases(current: CaseData[], alternate: CaseData[]): CaseData[] {
  return current.map((data) => {
    const otherCase = alternate.find(({ id }) => id === data.id);
    return {
      ...data,
      searchIndex: data.searchIndex.map((entry) => ({
        ...entry,
        keys: [...new Set([
          ...entry.keys,
          ...(otherCase?.searchIndex.find(({ id }) => id === entry.id)?.keys ?? []),
        ])],
      })),
    };
  });
}

// Stable objects prevent a presentation-language change from resetting a run.
const localizedCases: Record<Language, CaseData[]> = {
  en: mergeAliases(cases, russianCases),
  ru: mergeAliases(russianCases, cases),
};

export function getLocalizedCases(language: Language): CaseData[] {
  return localizedCases[language];
}

export function getLocalizedCase(id: string, language: Language): CaseData | undefined {
  return getLocalizedCases(language).find((data) => data.id === id);
}

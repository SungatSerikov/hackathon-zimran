import { getLocalizedCase } from "../cases/localized";
import type { HintOffer } from "../engine/hint";
import { clueOccurs, entryMatchesQuery } from "../engine/search";
import type { CaseData, CaseDocument, DocumentType, SearchKind } from "../types";
import type { Language } from "./language";

const clueLabels: Record<SearchKind, { en: string; ru: string }> = {
  name: { en: "person's name", ru: "имя человека" },
  company: { en: "company name", ru: "название компании" },
  phone: { en: "phone number", ru: "номер телефона" },
  address: { en: "address", ru: "адрес" },
  order: { en: "order or tracking number", ru: "номер заказа или отправления" },
  email: { en: "email address", ru: "адрес электронной почты" },
  plate: { en: "license plate", ru: "номер автомобиля" },
  other: { en: "distinctive name or identifier", ru: "название или идентификатор" },
};
const documentTitleLocations: Record<DocumentType, string> = {
  receipt: "заголовке открытого чека",
  contract: "заголовке открытого договора",
  chat: "заголовке открытой переписки",
  email: "заголовке открытого письма",
  ad: "заголовке открытого объявления",
  bank_statement: "заголовке открытой банковской выписки",
  note: "заголовке открытой заметки",
  record: "заголовке открытой записи",
};

function stepParts(hint: HintOffer, caseData: CaseData): string[] {
  try {
    const parts: unknown = JSON.parse(hint.stepKey);
    return Array.isArray(parts) && parts[0] === caseData.id &&
      parts.every((part) => typeof part === "string") ? parts.slice(1) : [];
  } catch {
    return [];
  }
}

function localizedQuery(hint: HintOffer, caseData: CaseData, openedIds: readonly string[]): string | undefined {
  if (!hint.query) return undefined;
  const ids = stepParts(hint, caseData);
  const entries = caseData.searchIndex.filter((entry) => ids.includes(entry.id));
  const matched = entries.length ? entries : caseData.searchIndex.filter(
    (entry) => entryMatchesQuery(entry, hint.query!),
  );
  const visibleText = [caseData.brief, ...caseData.documents
    .filter((document) => openedIds.includes(document.id)).map((document) => document.text)];
  // Localized cases put their own aliases first. Keep a shared query intact if
  // replacing it with one entry's alias would lose another discovery in the step.
  for (const entry of matched) {
    const key = entry.keys.find((candidate) =>
      visibleText.some((text) => clueOccurs(text, candidate, entry.kind)) &&
      matched.every((other) => entryMatchesQuery(other, candidate)),
    );
    if (key) return key;
  }
  return hint.query;
}

function localizedDocument(title: string, caseData: CaseData): CaseDocument | undefined {
  const variants = [caseData, getLocalizedCase(caseData.id, "en"), getLocalizedCase(caseData.id, "ru")];
  for (const variant of variants) {
    const source = variant?.documents.find((document) => document.title === title);
    if (source) return caseData.documents.find((document) => document.id === source.id);
  }
  return undefined;
}

/** Display saved and generated hints without changing paid steps or receipts. */
export function presentHint(
  hint: HintOffer,
  caseData: CaseData,
  language: Language,
  openedIds: readonly string[] = caseData.documents.filter((document) => document.initial).map((document) => document.id),
): Pick<HintOffer, "message" | "query"> {
  const parts = stepParts(hint, caseData);
  if (hint.level === 0) {
    if (parts.includes("verdict") || hint.message.startsWith("You have enough.")) {
      return { message: language === "ru"
        ? "Улик достаточно. Прикрепите два подтверждающих документа и вынесите вердикт в отношении ответчика."
        : "You have enough. Pin two supporting documents and stamp the respondent." };
    }
    if (parts.includes("no-lead") || hint.message.startsWith("No new search leads")) {
      return { message: language === "ru"
        ? "Новых зацепок для поиска нет. Перечитайте документы, которые уже есть в вашей папке."
        : "No new search leads are available. Review the documents already in your folder." };
    }
  }
  if (hint.level === 2 && hint.query) {
    const query = localizedQuery(hint, caseData, openedIds);
    const retry = hint.message.startsWith("Search again:") || hint.message.startsWith("Повторите поиск:");
    return { query, message: language === "ru"
      ? retry ? `Повторите поиск: ${query}. Эта зацепка теперь доступна.` : `Поиск: ${query}`
      : retry ? `Search again: ${query}. This clue is available now.` : `Search: ${query}` };
  }
  const nudge = /^Check the (.+) in (.+)\.$/.exec(hint.message);
  if (hint.level === 1 && nudge) {
    const [, label, originalLocation] = nudge;
    const clueLabel = Object.values(clueLabels).find((labels) => labels.en === label)?.[language] ?? label;
    let location = originalLocation;
    const quotedTitle = /^“(.+)”$/.exec(location)?.[1];
    if (quotedTitle) {
      const document = localizedDocument(quotedTitle, caseData);
      const titleGivesQuery = document && caseData.searchIndex.some((entry) =>
        parts.includes(entry.id) && entry.keys.some((key) => clueOccurs(document.title, key, entry.kind)),
      );
      if (document && titleGivesQuery) {
        location = language === "ru" ? documentTitleLocations[document.type]
          : `the title of the opened ${document.type.replaceAll("_", " ")}`;
      } else {
        const title = document?.title ?? quotedTitle;
        location = language === "ru" ? `документе «${title}»` : `“${title}”`;
      }
    } else if (location === "the case brief") {
      location = language === "ru" ? "кратком описании дела" : location;
    } else if (language === "ru") {
      const type = location.replace("the title of the opened ", "").replaceAll(" ", "_") as DocumentType;
      location = documentTitleLocations[type] ?? "заголовке открытого документа";
    }
    return { message: language === "ru"
      ? `Проверьте ${clueLabel} в ${location}.`
      : `Check the ${clueLabel} in ${location}.` };
  }
  return { message: hint.message, query: hint.query };
}

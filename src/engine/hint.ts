import type { CaseData, CaseDocument, SearchEntry, SearchKind } from "../types";
import { normalize } from "./normalize";
import { clueOccurs, searchCase } from "./search";
import { findShortestSearchPath } from "./validate";

export interface HintOffer {
  stepKey: string;
  level: 0 | 1 | 2;
  message: string;
  query?: string;
  free: boolean;
}

const clueLabels: Record<SearchKind, string> = {
  name: "person's name",
  company: "company name",
  phone: "phone number",
  address: "address",
  order: "order or tracking number",
  email: "email address",
  plate: "license plate",
  other: "distinctive name or identifier",
};

interface VisibleClue {
  entry: SearchEntry;
  key: string;
  document?: CaseDocument;
}

/** Guidance is derived only from searches executable from the current folder. */
export function getNextHint(
  caseData: CaseData,
  openedIds: string[],
  queries: string[],
  history: HintOffer[],
): HintOffer {
  const knownIds = new Set(caseData.documents.map((document) => document.id));
  const opened = [...new Set(openedIds)].filter((id) => knownIds.has(id));
  const required = new Set(caseData.solution.requiredEvidence);
  if (opened.filter((id) => required.has(id)).length >= 2) {
    return {
      stepKey: JSON.stringify([caseData.id, "verdict"]),
      level: 0,
      message:
        "You have enough. Pin two supporting documents and stamp the respondent.",
      free: true,
    };
  }

  const noLead: HintOffer = {
    stepKey: JSON.stringify([caseData.id, "no-lead"]),
    level: 0,
    message:
      "No new search leads are available. Review the documents already in your folder.",
    free: true,
  };
  const path = findShortestSearchPath(caseData, opened);
  if (!path?.length) return noLead;
  const planned = searchCase(caseData, opened, path[0]);
  const visibleDocuments = caseData.documents.filter((document) =>
    opened.includes(document.id),
  );
  const sources: VisibleClue[] = [];
  for (const entry of caseData.searchIndex) {
    if (!planned.matchedEntryIds.includes(entry.id)) continue;
    for (const document of visibleDocuments) {
      for (const key of entry.keys) {
        if (clueOccurs(document.text, key, entry.kind))
          sources.push({ entry, key, document });
      }
    }
    for (const key of entry.keys) {
      if (clueOccurs(caseData.brief, key, entry.kind))
        sources.push({ entry, key });
    }
  }
  if (!sources.length) return noLead;

  // An unlocked entry may have an unseen primary alias. Prefer a key the player
  // can actually read, provided it preserves every discovery in the optimal step.
  const visibleEquivalent = sources.find((source) => {
    const result = searchCase(caseData, opened, source.key);
    return planned.newDocumentIds.every((id) =>
      result.newDocumentIds.includes(id),
    );
  });
  const source = visibleEquivalent ?? sources[0];
  const query = visibleEquivalent?.key ?? path[0];
  const result = searchCase(caseData, opened, query);
  const stepKey = JSON.stringify([
    caseData.id,
    ...result.matchedEntryIds.sort(),
  ]);
  const previous = history.filter((hint) => hint.stepKey === stepKey);
  if (previous.some((hint) => hint.level === 1 || hint.level === 2)) {
    // A previous query may have failed while its clue was still locked. Folder
    // state determines completion; query history alone must never skip that step.
    const triedBefore = queries.some(
      (previousQuery) =>
        normalize(previousQuery, source.entry.kind) ===
        normalize(query, source.entry.kind),
    );
    return {
      stepKey,
      level: 2,
      message: triedBefore
        ? `Search again: ${query}. This clue is available now.`
        : `Search: ${query}`,
      query,
      free: previous.some((hint) => hint.level === 2),
    };
  }

  const label = clueLabels[source.entry.kind];
  let location = "the case brief";
  if (source.document) {
    const titleGivesQuery = source.entry.keys.some((key) =>
      clueOccurs(source.document!.title, key, source.entry.kind),
    );
    location = titleGivesQuery
      ? `the title of the opened ${source.document.type.replaceAll("_", " ")}`
      : `“${source.document.title}”`;
  }
  return {
    stepKey,
    level: 1,
    message: `Check the ${label} in ${location}.`,
    free: false,
  };
}

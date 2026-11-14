import type { Accusation, CaseData } from "../types";

export function evaluateVerdict(
  caseData: CaseData,
  accusation: Accusation,
): boolean {
  const solution = caseData.solution;
  return (
    accusation.verdict === solution.verdict &&
    accusation.culprit === solution.culprit &&
    accusation.method === solution.correctMethod &&
    accusation.evidence.length === 2 &&
    new Set(accusation.evidence).size === 2 &&
    accusation.evidence.every((id) => solution.requiredEvidence.includes(id))
  );
}

import tutorial from "./tutorial.json";
import main from "./main.json";
import type { CaseData } from "../types";

export const cases: CaseData[] = [tutorial as CaseData, main as CaseData];

export function getCase(id: string): CaseData | undefined {
  return cases.find((caseData) => caseData.id === id);
}

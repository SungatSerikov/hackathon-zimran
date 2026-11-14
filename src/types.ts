export type DocumentType =
  | "receipt"
  | "contract"
  | "chat"
  | "email"
  | "ad"
  | "bank_statement"
  | "note"
  | "record";
export type SearchKind =
  | "name"
  | "company"
  | "phone"
  | "address"
  | "order"
  | "email"
  | "plate"
  | "other";
export type Verdict = "GUILTY" | "NOT_GUILTY";
export interface Claim {
  number: string;
  claimant: string;
  respondent: string;
  request: string;
  amount?: number;
  statement: string;
}
export interface DocumentBody {
  vendor?: string;
  number?: string;
  date?: string;
  items?: { name: string; amount: number }[];
  total?: number;
  paymentMethod?: string;
  parties?: string[];
  clauses?: string[];
  participants?: string[];
  messages?: { from: string; time: string; text: string }[];
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  headline?: string;
  phone?: string;
  address?: string;
  owner?: string;
  rows?: { date: string; description: string; amount: number }[];
  heading?: string;
}
export interface CaseDocument {
  id: string;
  type: DocumentType;
  title: string;
  initial: boolean;
  body: DocumentBody;
  text: string;
}
export interface Character {
  id: string;
  name: string;
  role: string;
  portrait: string;
}
export interface SearchEntry {
  id: string;
  keys: string[];
  kind: SearchKind;
  reveals: string[];
}
export interface CaseData {
  id: string;
  title: string;
  difficulty: number;
  estMinutes: number;
  premium: boolean;
  brief: string;
  claim: Claim;
  worldDate?: string;
  gameDate?: string;
  characters: Character[];
  documents: CaseDocument[];
  searchIndex: SearchEntry[];
  solution: {
    verdict: Verdict;
    culprit: string;
    methods: { id: string; text: string }[];
    correctMethod: string;
    requiredEvidence: string[];
    explanation: string;
  };
}
export interface Accusation {
  verdict: Verdict;
  culprit: string;
  method: string;
  evidence: string[];
}
export interface SearchResult {
  documentIds: string[];
  newDocumentIds: string[];
  matchedEntryIds: string[];
}
export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  reachableDocumentIds: string[];
  minimumSearches: number;
  solutionPath: string[];
}
export interface ScoreInput {
  elapsedSeconds: number;
  wrongAttempts: number;
  searches: number;
  minimumSearches: number;
  hints?: number;
}

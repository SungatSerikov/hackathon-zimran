import type { CaseData, CaseDocument } from "../types";

export const note = (
  id: string,
  text: string,
  initial = false,
): CaseDocument => ({
  id,
  type: "note",
  title: id,
  initial,
  text,
  body: { body: text },
});

export const makeCase = (): CaseData => ({
  id: "test-case",
  title: "A test case",
  difficulty: 1,
  estMinutes: 5,
  premium: false,
  brief: "Investigate Arbor Repairs.",
  claim: { number: "001", claimant: "client", respondent: "Arbor Repairs", request: "Refund", amount: 100, statement: "I paid twice." },
  characters: [
    { id: "client", name: "Amy Gray", role: "Client", portrait: "amy.webp" },
    { id: "owner", name: "Sam Hall", role: "Owner", portrait: "sam.webp" },
  ],
  documents: [
    note("start", "Arbor Repairs.", true),
    note("lead", "Call (555) 010-4471 about AB-901."),
    note("payment", "The first payment cleared."),
    note("invoice", "The second payment cleared."),
  ],
  searchIndex: [
    {
      id: "company",
      keys: ["Arbor Repairs"],
      kind: "company",
      reveals: ["lead"],
    },
    { id: "phone", keys: ["5550104471"], kind: "phone", reveals: ["payment"] },
    { id: "order", keys: ["AB901"], kind: "order", reveals: ["invoice"] },
  ],
  solution: {
    verdict: "GUILTY",
    culprit: "owner",
    methods: [
      { id: "duplicate", text: "Charged twice." },
      { id: "bank", text: "Bank error." },
      { id: "customer", text: "Customer error." },
    ],
    correctMethod: "duplicate",
    requiredEvidence: ["payment", "invoice"],
    explanation: "The two receipts show duplicate payment.",
  },
});

import type { CaseData } from "../types";
import type { GameRun } from "../store/game";
import type { HintOffer } from "./hint";
import { safeRead, safeWrite } from "../lib/storage";

interface WalletEntry {
  ts: string;
  caseId: string;
  amount: number;
  reason: string;
}
interface WalletReceipt extends WalletEntry {
  id: string;
  runId: string;
  kind: "award" | "hint";
  stepKey?: string;
  level?: 1 | 2;
}
export interface Wallet {
  balance: number;
  history: WalletEntry[];
  /** Permanent receipts remain after the visible history is trimmed. */
  receipts: WalletReceipt[];
}
const STORAGE_KEY = "cd.wallet";
const STARTING_CENTS = 10_000;
const HINT_COST = 40;
let memory: Wallet | undefined;

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function identifier(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 300
  );
}
function money(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER / 100 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}
function awardId(runId: string): string {
  return JSON.stringify(["award", runId]);
}
function hintId(runId: string, stepKey: string, level: number): string {
  return JSON.stringify(["hint", runId, stepKey, level]);
}

function validEntry(value: unknown): value is WalletEntry {
  return (
    object(value) &&
    typeof value.ts === "string" &&
    Number.isFinite(Date.parse(value.ts)) &&
    identifier(value.caseId) &&
    typeof value.amount === "number" &&
    money(Math.abs(value.amount)) &&
    typeof value.reason === "string" &&
    value.reason.length > 0 &&
    value.reason.length <= 100
  );
}

function validReceipt(value: unknown): value is WalletReceipt {
  if (!validEntry(value) || !object(value) || !identifier(value.runId))
    return false;
  if (value.kind === "award")
    return (
      value.id === awardId(value.runId) &&
      value.amount > 0 &&
      value.amount <= 500 &&
      ["Case fee", "Repeat case fee"].includes(value.reason)
    );
  return (
    value.kind === "hint" &&
    identifier(value.stepKey) &&
    (value.level === 1 || value.level === 2) &&
    value.id === hintId(value.runId, value.stepKey, value.level) &&
    value.amount === -HINT_COST &&
    value.reason === "Informant hint"
  );
}

function fromReceipts(receipts: WalletReceipt[]): Wallet | null {
  const cents = receipts.reduce(
    (total, receipt) => total + Math.round(receipt.amount * 100),
    STARTING_CENTS,
  );
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return {
    balance: cents / 100,
    history: receipts
      .slice(-100)
      .map(({ ts, caseId, amount, reason }) => ({
        ts,
        caseId,
        amount,
        reason,
      })),
    receipts: receipts.map((receipt) => ({ ...receipt })),
  };
}

function readWallet(value: unknown): Wallet | null {
  if (
    !object(value) ||
    !money(value.balance) ||
    !Array.isArray(value.history) ||
    !value.history.every(validEntry) ||
    !Array.isArray(value.receipts) ||
    !value.receipts.every(validReceipt)
  )
    return null;
  if (
    new Set(value.receipts.map((receipt) => receipt.id)).size !==
    value.receipts.length
  )
    return null;
  const wallet = fromReceipts(value.receipts);
  return wallet?.balance === value.balance ? wallet : null;
}

function currentWallet(): Wallet {
  const saved = readWallet(safeRead<unknown>(STORAGE_KEY, null));
  const receipts = new Map<string, WalletReceipt>();
  for (const receipt of [
    ...(saved?.receipts ?? []),
    ...(memory?.receipts ?? []),
  ]) {
    if (!receipts.has(receipt.id)) receipts.set(receipt.id, receipt);
  }
  memory =
    fromReceipts([...receipts.values()]) ??
    memory ??
    saved ??
    fromReceipts([])!;
  return memory;
}

function snapshot(wallet: Wallet): Wallet {
  return {
    balance: wallet.balance,
    history: wallet.history.map((entry) => ({ ...entry })),
    receipts: wallet.receipts.map((receipt) => ({ ...receipt })),
  };
}

function append(wallet: Wallet, receipt: WalletReceipt): Wallet {
  memory = fromReceipts([...wallet.receipts, receipt])!;
  safeWrite(STORAGE_KEY, memory);
  return snapshot(memory);
}

export function getWallet(): Wallet {
  return snapshot(currentWallet());
}

export function calculateFee(
  caseData: CaseData,
  run: { elapsedSeconds: number; wrongAttempts: number },
  repeat = false,
): number {
  if (
    !Number.isInteger(caseData.difficulty) ||
    caseData.difficulty < 1 ||
    caseData.difficulty > 3 ||
    !Number.isFinite(caseData.estMinutes) ||
    caseData.estMinutes <= 0 ||
    !Number.isFinite(run.elapsedSeconds) ||
    run.elapsedSeconds < 0 ||
    !Number.isInteger(run.wrongAttempts) ||
    run.wrongAttempts < 0 ||
    run.wrongAttempts >= 3
  )
    return 0;
  const base = 100 * caseData.difficulty;
  const targetSeconds = caseData.estMinutes * 60;
  const speed =
    run.elapsedSeconds <= targetSeconds
      ? base * 0.5
      : run.elapsedSeconds <= targetSeconds * 1.5
        ? base * 0.25
        : 0;
  const total = base + speed + (run.wrongAttempts === 0 ? 50 : 0);
  return Math.round(total * (repeat ? 0.25 : 1) * 100) / 100;
}

export function awardCaseFee(
  caseData: CaseData,
  run: GameRun,
): { wallet: Wallet; fee: number; alreadyAwarded: boolean } {
  const wallet = currentWallet();
  if (
    run.status !== "solved" ||
    run.caseId !== caseData.id ||
    !identifier(run.runId)
  )
    return { wallet: snapshot(wallet), fee: 0, alreadyAwarded: false };
  const receipt = wallet.receipts.find(
    (item) => item.id === awardId(run.runId),
  );
  if (receipt)
    return {
      wallet: snapshot(wallet),
      fee: receipt.caseId === caseData.id ? receipt.amount : 0,
      alreadyAwarded: true,
    };
  const repeat = wallet.receipts.some(
    (item) => item.kind === "award" && item.caseId === caseData.id,
  );
  const fee = calculateFee(caseData, run, repeat);
  if (fee === 0)
    return { wallet: snapshot(wallet), fee: 0, alreadyAwarded: false };
  return {
    wallet: append(wallet, {
      id: awardId(run.runId),
      runId: run.runId,
      kind: "award",
      ts: new Date().toISOString(),
      caseId: caseData.id,
      amount: fee,
      reason: repeat ? "Repeat case fee" : "Case fee",
    }),
    fee,
    alreadyAwarded: false,
  };
}

export function purchaseHint(
  caseData: CaseData,
  run: GameRun,
  hint: HintOffer,
): { wallet: Wallet; success: boolean; charged: number } {
  const wallet = currentWallet();
  const unchanged = (success: boolean) => ({
    wallet: snapshot(wallet),
    success,
    charged: 0,
  });
  if (
    run.status !== "playing" ||
    run.caseId !== caseData.id ||
    !identifier(run.runId) ||
    !hint ||
    !identifier(hint.stepKey) ||
    ![0, 1, 2].includes(hint.level) ||
    typeof hint.message !== "string" ||
    !hint.message.trim() ||
    typeof hint.free !== "boolean" ||
    (hint.query !== undefined &&
      (typeof hint.query !== "string" || !hint.query.trim()))
  )
    return unchanged(false);
  const receipt = wallet.receipts.find(
    (item) => item.id === hintId(run.runId, hint.stepKey, hint.level),
  );
  if (receipt) return unchanged(receipt.caseId === caseData.id);
  if (hint.free) return unchanged(true);
  if (hint.level === 0 || wallet.balance < HINT_COST) return unchanged(false);
  return {
    wallet: append(wallet, {
      id: hintId(run.runId, hint.stepKey, hint.level),
      runId: run.runId,
      kind: "hint",
      stepKey: hint.stepKey,
      level: hint.level,
      ts: new Date().toISOString(),
      caseId: caseData.id,
      amount: -HINT_COST,
      reason: "Informant hint",
    }),
    success: true,
    charged: HINT_COST,
  };
}

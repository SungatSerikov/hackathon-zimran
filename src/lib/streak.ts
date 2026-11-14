import { safeRead, safeWrite } from "./storage";

interface StreakState {
  lastDate: string;
  count: number;
}
const STORAGE_KEY = "case-desk:streak:v1";
let memory: StreakState | null = null;
let memoryOnly = false;

function localDate(now: Date): string | null {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null;
  const year = now.getFullYear();
  if (year < 0 || year > 9999) return null;
  return `${String(year).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  // Compare civil days in UTC so daylight-saving changes never make a day 23/25 hours.
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return null;
  return Math.floor(date.getTime() / 86_400_000);
}

function readState(): StreakState | null {
  if (memoryOnly) return memory;
  const value = safeRead<unknown>(STORAGE_KEY, memory);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (
    typeof state.lastDate !== "string" ||
    calendarDay(state.lastDate) === null ||
    typeof state.count !== "number" ||
    !Number.isSafeInteger(state.count) ||
    state.count < 1
  )
    return null;
  memory = { lastDate: state.lastDate, count: state.count };
  return memory;
}

export function getStreak(now: Date = new Date()): number {
  const today = localDate(now);
  const state = readState();
  if (!today || !state) return 0;
  const elapsedDays = calendarDay(today)! - calendarDay(state.lastDate)!;
  return elapsedDays === 0 || elapsedDays === 1 ? state.count : 0;
}

export function recordVisit(now: Date = new Date()): number {
  const today = localDate(now);
  if (!today) return 0;
  const previous = readState();
  const elapsedDays = previous
    ? calendarDay(today)! - calendarDay(previous.lastDate)!
    : null;
  const count =
    previous && elapsedDays === 0
      ? previous.count
      : previous && elapsedDays === 1
        ? Math.min(Number.MAX_SAFE_INTEGER, previous.count + 1)
        : 1;
  memory = { lastDate: today, count };
  memoryOnly = !safeWrite(STORAGE_KEY, memory);
  return count;
}

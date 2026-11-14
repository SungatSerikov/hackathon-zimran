import { safeRead, safeWrite } from "./storage";

export interface ScoreRecord {
  id: string;
  case_id: string;
  nickname: string;
  score: number;
  time_ms: number;
  wrong: number;
  searches: number;
  created_at: string;
}

type ScoreInput = Omit<ScoreRecord, "id" | "created_at">;
type Source = "online" | "local";
type StoredScore = ScoreRecord & { uploaded?: boolean };
type WaitlistResult = { count: number; joined: boolean; source: Source };
type WaitlistState = { id: string; joined: boolean; online: boolean };
const SCORES_KEY = "case-desk:scores:v1";
const WAITLIST_KEY = "case-desk:waitlist:v1";
const REQUEST_TIMEOUT_MS = 4_000;
const CASE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
let memoryScores: StoredScore[] | undefined;
let memoryWaitlist: WaitlistState | undefined;
const pendingScores = new Map<string, Promise<{ source: Source }>>();
let pendingJoin: Promise<WaitlistResult> | undefined;

function integer(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

function validInput(value: unknown): value is ScoreInput {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.case_id === "string" &&
    CASE_ID.test(item.case_id) &&
    typeof item.nickname === "string" &&
    item.nickname.trim().length >= 2 &&
    item.nickname.length <= 20 &&
    !/[\u0000-\u001f\u007f]/.test(item.nickname) &&
    integer(item.score, 1000) &&
    integer(item.time_ms, 2_147_483_647) &&
    integer(item.wrong, 3) &&
    integer(item.searches, 10_000)
  );
}

function validRecord(value: unknown): value is StoredScore {
  if (!validInput(value)) return false;
  const item = value as unknown as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    item.id.length <= 80 &&
    typeof item.created_at === "string" &&
    Number.isFinite(Date.parse(item.created_at))
  );
}

function readScores(): StoredScore[] {
  const saved = safeRead<unknown>(SCORES_KEY, []);
  memoryScores = mergeScores(
    Array.isArray(saved) ? saved.filter(validRecord) : [],
    memoryScores ?? [],
  );
  return memoryScores;
}

function writeScores(scores: StoredScore[]): void {
  // Refresh before writing so another tab's completed save is not overwritten.
  memoryScores = mergeScores(readScores(), scores);
  safeWrite(SCORES_KEY, memoryScores);
}

function mergeScores(...groups: StoredScore[][]): StoredScore[] {
  const byId = new Map<string, StoredScore>();
  const bySignature = new Map<string, StoredScore>();
  const merged: StoredScore[] = [];
  for (const score of groups.flat()) {
    const signature = fingerprint(score);
    const existing = byId.get(score.id) ?? bySignature.get(signature);
    if (existing) {
      // A stale copy must not turn an acknowledged upload into a pending one.
      existing.uploaded = existing.uploaded === true || score.uploaded === true;
      byId.set(score.id, existing);
      bySignature.set(signature, existing);
      continue;
    }
    const record = { ...publicScore(score), uploaded: score.uploaded === true };
    merged.push(record);
    byId.set(record.id, record);
    bySignature.set(signature, record);
  }
  // Keep a deterministic, bounded newest archive, including unsaved session data
  // when browser storage is blocked or its quota has been reached.
  return merged
    .sort(
      (a, b) =>
        Date.parse(a.created_at) - Date.parse(b.created_at) ||
        a.id.localeCompare(b.id),
    )
    .slice(-500);
}

function publicScore(score: ScoreRecord): ScoreRecord {
  const {
    id,
    case_id,
    nickname,
    score: points,
    time_ms,
    wrong,
    searches,
    created_at,
  } = score;
  return {
    id,
    case_id,
    nickname,
    score: points,
    time_ms,
    wrong,
    searches,
    created_at,
  };
}

function ranked(scores: ScoreRecord[], caseId: string): ScoreRecord[] {
  return scores
    .filter((score) => score.case_id === caseId)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.time_ms - b.time_ms ||
        a.created_at.localeCompare(b.created_at),
    )
    .slice(0, 10)
    .map(publicScore);
}

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (letter) => {
    const random = Math.floor(Math.random() * 16);
    return (letter === "x" ? random : (random & 3) | 8).toString(16);
  });
}

function waitlistState(): WaitlistState {
  if (memoryWaitlist) return memoryWaitlist;
  const saved = safeRead<unknown>(WAITLIST_KEY, undefined);
  if (saved && typeof saved === "object") {
    const item = saved as Record<string, unknown>;
    if (
      typeof item.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(item.id) &&
      typeof item.joined === "boolean" &&
      typeof item.online === "boolean"
    ) {
      memoryWaitlist = {
        id: item.id,
        joined: item.joined,
        online: item.online,
      };
    }
  }
  if (!memoryWaitlist) {
    memoryWaitlist = { id: newId(), joined: false, online: false };
    safeWrite(WAITLIST_KEY, memoryWaitlist);
  }
  return memoryWaitlist;
}

function saveWaitlist(state: WaitlistState): void {
  memoryWaitlist = state;
  safeWrite(WAITLIST_KEY, state);
}

function configuration(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      )
    )
      return null;
    return { url: url.replace(/\/+$/, ""), key };
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  decode: (response: Response) => Promise<T>,
): Promise<T> {
  const config = configuration();
  if (!config) throw new Error("Online records are not configured.");
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new Error("Records request timed out."));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(`${config.url}/rest/v1/${path}`, {
          ...init,
          signal: abort.signal,
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
            "Content-Type": "application/json",
            ...init.headers,
          },
        });
        if (!response.ok) throw new Error("Records service is unavailable.");
        return decode(response);
      })(),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function getScores(
  caseId: string,
): Promise<{ scores: ScoreRecord[]; source: Source }> {
  if (!CASE_ID.test(caseId)) return { scores: [], source: "local" };
  try {
    const scores = await request(
      `scores?select=id,case_id,nickname,score,time_ms,wrong,searches,created_at&case_id=eq.${encodeURIComponent(caseId)}&order=score.desc,time_ms.asc,created_at.asc&limit=10`,
      {},
      async (response) => {
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(validRecord))
          throw new Error("Invalid records response.");
        return ranked(data, caseId);
      },
    );
    return { scores, source: "online" };
  } catch {
    return { scores: ranked(readScores(), caseId), source: "local" };
  }
}

function fingerprint(score: ScoreInput): string {
  return JSON.stringify([
    score.case_id,
    score.nickname,
    score.score,
    score.time_ms,
    score.wrong,
    score.searches,
  ]);
}

export async function submitScore(
  input: ScoreInput,
): Promise<{ source: Source }> {
  const normalized = {
    ...input,
    nickname: typeof input?.nickname === "string" ? input.nickname.trim() : "",
  };
  if (!validInput(normalized))
    throw new Error("Use a 2–20 character nickname and valid game results.");
  const key = fingerprint(normalized);
  const pending = pendingScores.get(key);
  if (pending) return pending;
  const operation = (async (): Promise<{ source: Source }> => {
    const scores = readScores();
    let record = scores.find((item) => fingerprint(item) === key);
    if (record?.uploaded) return { source: "online" };
    if (!record) {
      record = {
        ...normalized,
        id: newId(),
        created_at: new Date().toISOString(),
      };
      writeScores([...scores, record]);
    }
    try {
      // Stable IDs make retries idempotent even if the first response was lost.
      await request(
        "scores?on_conflict=id",
        {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify(publicScore(record)),
        },
        async () => undefined,
      );
      writeScores(
        readScores().map((item) =>
          item.id === record.id ? { ...item, uploaded: true } : item,
        ),
      );
      return { source: "online" };
    } catch {
      return { source: "local" };
    }
  })();
  pendingScores.set(key, operation);
  try {
    return await operation;
  } finally {
    pendingScores.delete(key);
  }
}

async function remoteCount(): Promise<number> {
  return request(
    "waitlist_clicks?select=id",
    { method: "HEAD", headers: { Prefer: "count=exact", Range: "0-0" } },
    async (response) => {
      const total = response.headers
        .get("content-range")
        ?.match(/\/(\d+)$/)?.[1];
      const count = total === undefined ? NaN : Number(total);
      if (!Number.isSafeInteger(count) || count < 0)
        throw new Error("Invalid waitlist count.");
      return count;
    },
  );
}

export async function getWaitlist(): Promise<WaitlistResult> {
  const state = waitlistState();
  // Finish an already requested registration after connectivity returns.
  if (state.joined && !state.online) return joinWaitlist();
  try {
    return {
      count: await remoteCount(),
      joined: state.joined,
      source: "online",
    };
  } catch {
    return {
      count: state.joined ? 1 : 0,
      joined: state.joined,
      source: "local",
    };
  }
}

export async function joinWaitlist(): Promise<WaitlistResult> {
  if (pendingJoin) return pendingJoin;
  const operation = (async (): Promise<WaitlistResult> => {
    let state = { ...waitlistState(), joined: true };
    saveWaitlist(state);
    try {
      if (!state.online) {
        await request(
          "waitlist_clicks?on_conflict=id",
          {
            method: "POST",
            headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
            body: JSON.stringify({ id: state.id }),
          },
          async () => undefined,
        );
        state = { ...state, online: true };
        saveWaitlist(state);
      }
      return { count: await remoteCount(), joined: true, source: "online" };
    } catch {
      return { count: 1, joined: true, source: "local" };
    }
  })();
  pendingJoin = operation;
  try {
    return await operation;
  } finally {
    pendingJoin = undefined;
  }
}

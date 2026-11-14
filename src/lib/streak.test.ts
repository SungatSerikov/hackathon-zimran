import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let storage: Map<string, string>;
const day = (date: number, month = 10, year = 2026) =>
  new Date(year, month, date, 12);
beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("daily play streak", () => {
  it("records a day once, persists across reloads, and continues consecutive days", async () => {
    let streak = await import("./streak");
    expect(streak.getStreak(day(14))).toBe(0);
    expect(streak.recordVisit(day(14))).toBe(1);
    expect(streak.recordVisit(day(14))).toBe(1);
    vi.resetModules();
    streak = await import("./streak");
    expect(streak.getStreak(day(14))).toBe(1);
    expect(streak.getStreak(day(15))).toBe(1);
    expect(streak.recordVisit(day(15))).toBe(2);
    expect(streak.recordVisit(day(16))).toBe(3);
  });

  it("keeps yesterday visible without recording a new visit, and resets after a missed day", async () => {
    const streak = await import("./streak");
    streak.recordVisit(day(14));
    streak.recordVisit(day(15));
    expect(streak.getStreak(day(16))).toBe(2);
    expect(streak.getStreak(day(17))).toBe(0);
    expect(streak.recordVisit(day(17))).toBe(1);
  });

  it("uses browser calendar dates, including year and leap-day boundaries", async () => {
    const streak = await import("./streak");
    expect(streak.recordVisit(new Date(2027, 11, 31, 23, 59))).toBe(1);
    expect([...storage.values()][0]).toContain("2027-12-31");
    expect(streak.recordVisit(new Date(2028, 0, 1, 0, 1))).toBe(2);
    expect(streak.recordVisit(day(28, 1, 2028))).toBe(1);
    expect(streak.recordVisit(day(29, 1, 2028))).toBe(2);
    expect(streak.recordVisit(day(1, 2, 2028))).toBe(3);
  });

  it("ignores corrupt stored counters and impossible calendar dates", async () => {
    const streak = await import("./streak");
    streak.recordVisit(day(14));
    const key = [...storage.keys()][0];
    for (const invalid of [
      null,
      [],
      { lastDate: "2026-11-14", count: -1 },
      { lastDate: "2026-11-14", count: "7" },
      { lastDate: "2026-11-14", count: 2.5 },
      { lastDate: "2026-02-30", count: 5 },
      { lastDate: "not-a-date", count: 5 },
    ]) {
      storage.set(key, JSON.stringify(invalid));
      vi.resetModules();
      expect((await import("./streak")).getStreak(day(14))).toBe(0);
    }
    storage.set(key, "{broken");
    vi.resetModules();
    expect((await import("./streak")).recordVisit(day(14))).toBe(1);
  });

  it("does not count future stored dates or invalid clock input", async () => {
    const streak = await import("./streak");
    streak.recordVisit(day(15));
    expect(streak.getStreak(day(14))).toBe(0);
    expect(streak.recordVisit(new Date(NaN))).toBe(0);
    expect(streak.getStreak(new Date(NaN))).toBe(0);
    expect(streak.getStreak(day(15))).toBe(1);
  });

  it("stays usable with blocked storage and retains a session streak", async () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    });
    const streak = await import("./streak");
    expect(streak.recordVisit(day(14))).toBe(1);
    expect(streak.recordVisit(day(14))).toBe(1);
    expect(streak.recordVisit(day(15))).toBe(2);
    expect(streak.getStreak(day(15))).toBe(2);
  });

  it("does not regress to stale persisted data when quota prevents a write", async () => {
    const streak = await import("./streak");
    streak.recordVisit(day(14));
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem() {
        throw new Error("quota");
      },
    });
    expect(streak.recordVisit(day(15))).toBe(2);
    expect(streak.getStreak(day(15))).toBe(2);
    expect(streak.recordVisit(day(16))).toBe(3);
  });
});

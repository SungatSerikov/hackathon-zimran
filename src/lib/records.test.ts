import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sample = {
  case_id: "tutorial",
  nickname: "Ada",
  score: 840,
  time_ms: 120_000,
  wrong: 0,
  searches: 3,
};
let storage: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("local records", () => {
  it("returns only the requested case, ranked by score then faster time, with ten entries", async () => {
    const records = await import("./records");
    for (let index = 0; index < 12; index++) {
      await records.submitScore({
        ...sample,
        nickname: `Player ${index}`,
        score: 800 + index,
      });
    }
    await records.submitScore({
      ...sample,
      nickname: "Fast Ada",
      score: 811,
      time_ms: 90_000,
    });
    await records.submitScore({
      ...sample,
      case_id: "another-case",
      score: 999,
    });
    const result = await records.getScores("tutorial");
    expect(result.source).toBe("local");
    expect(result.scores).toHaveLength(10);
    expect(result.scores[0]).toMatchObject({
      nickname: "Fast Ada",
      score: 811,
    });
    expect(result.scores.every((score) => score.case_id === "tutorial")).toBe(
      true,
    );
  });

  it("deduplicates identical submissions including simultaneous clicks", async () => {
    const records = await import("./records");
    await Promise.all([
      records.submitScore(sample),
      records.submitScore(sample),
    ]);
    await records.submitScore(sample);
    expect((await records.getScores("tutorial")).scores).toHaveLength(1);
  });

  it("rejects invalid values instead of persisting impossible records", async () => {
    const records = await import("./records");
    for (const patch of [
      { nickname: " " },
      { score: NaN },
      { score: 1001 },
      { time_ms: -1 },
      { wrong: 4 },
      { searches: 0.5 },
      { case_id: "a&or=1" },
    ]) {
      await expect(
        records.submitScore({ ...sample, ...patch }),
      ).rejects.toThrow();
    }
    expect((await records.getScores("tutorial")).scores).toEqual([]);
  });

  it("keeps the local interest count at one across clicks and module reloads", async () => {
    let records = await import("./records");
    expect(await records.getWaitlist()).toEqual({
      count: 0,
      joined: false,
      source: "local",
    });
    await Promise.all([records.joinWaitlist(), records.joinWaitlist()]);
    vi.resetModules();
    records = await import("./records");
    expect(await records.joinWaitlist()).toEqual({
      count: 1,
      joined: true,
      source: "local",
    });
  });

  it("stays usable and deduplicates locally when browser storage is blocked", async () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    });
    const records = await import("./records");
    await records.submitScore(sample);
    expect((await records.getScores("tutorial")).scores[0]).toMatchObject(
      sample,
    );
    await records.joinWaitlist();
    expect(await records.joinWaitlist()).toEqual({
      count: 1,
      joined: true,
      source: "local",
    });
  });

  it("retains new records in memory when existing storage becomes read-only", async () => {
    const records = await import("./records");
    await records.submitScore(sample);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem() {
        throw new Error("quota exceeded");
      },
    });
    await records.submitScore({ ...sample, nickname: "Grace", score: 950 });
    expect(
      (await records.getScores("tutorial")).scores.map(
        (score) => score.nickname,
      ),
    ).toEqual(["Grace", "Ada"]);
  });

  it("merges scores saved by another initialized tab before reading and writing", async () => {
    const firstTab = await import("./records");
    await firstTab.getScores("tutorial");
    vi.resetModules();
    const secondTab = await import("./records");
    await secondTab.getScores("tutorial");
    await secondTab.submitScore({ ...sample, nickname: "Grace", score: 950 });
    expect(
      (await firstTab.getScores("tutorial")).scores.map(
        (score) => score.nickname,
      ),
    ).toEqual(["Grace"]);
    await firstTab.submitScore(sample);
    vi.resetModules();
    const fresh = await import("./records");
    expect(
      (await fresh.getScores("tutorial")).scores.map((score) => score.nickname),
    ).toEqual(["Grace", "Ada"]);
  });

  it("discards corrupted persisted records", async () => {
    const records = await import("./records");
    await records.submitScore(sample);
    for (const [key, value] of storage) {
      if (value.includes("Ada"))
        storage.set(
          key,
          JSON.stringify([
            { ...sample, id: "broken", score: 90000, created_at: "today" },
          ]),
        );
    }
    vi.resetModules();
    const fresh = await import("./records");
    expect((await fresh.getScores("tutorial")).scores).toEqual([]);
  });
});

describe("optional online records", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-anon-key");
  });

  it("returns validated online scores and an exact server interest count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/scores")
          ? new Response(
              JSON.stringify([
                {
                  ...sample,
                  id: "score-id",
                  created_at: "2026-11-14T00:00:00Z",
                },
              ]),
            )
          : new Response(null, { headers: { "content-range": "0-0/42" } }),
      ),
    );
    const records = await import("./records");
    expect((await records.getScores("tutorial")).source).toBe("online");
    expect(await records.getWaitlist()).toEqual({
      count: 42,
      joined: false,
      source: "online",
    });
  });

  it("falls back to local state for failed or malformed server responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );
    const records = await import("./records");
    expect(await records.submitScore(sample)).toEqual({ source: "local" });
    expect((await records.getScores("tutorial")).scores).toHaveLength(1);
    expect(await records.joinWaitlist()).toEqual({
      count: 1,
      joined: true,
      source: "local",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}")),
    );
    expect((await records.getScores("tutorial")).source).toBe("local");
    expect((await records.getWaitlist()).source).toBe("local");
  });

  it("stops waiting for a hung remote request", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const records = await import("./records");
    const result = records.getScores("tutorial");
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await result).toEqual({ scores: [], source: "local" });
  });

  it("makes one remote write for simultaneous score submissions", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    const records = await import("./records");
    expect(
      await Promise.all([
        records.submitScore(sample),
        records.submitScore(sample),
      ]),
    ).toEqual([{ source: "online" }, { source: "online" }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("preserves uploaded status when a stale tab resubmits the same score", async () => {
    let writes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        if (init.method === "POST") {
          writes++;
          return new Response(null, { status: 201 });
        }
        return new Response(null, { status: 503 });
      }),
    );
    const firstTab = await import("./records");
    await firstTab.getScores("tutorial");
    vi.resetModules();
    const secondTab = await import("./records");
    await secondTab.getScores("tutorial");
    await firstTab.submitScore(sample);
    expect(await secondTab.submitScore(sample)).toEqual({ source: "online" });
    expect(writes).toBe(1);
  });

  it("syncs locally recorded interest when the service recovers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const records = await import("./records");
    expect(await records.joinWaitlist()).toEqual({
      count: 1,
      joined: true,
      source: "local",
    });
    let registered = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        if (init.method === "POST") {
          registered = true;
          return new Response(null, { status: 201 });
        }
        return new Response(null, {
          headers: { "content-range": `0-0/${registered ? 42 : 41}` },
        });
      }),
    );
    expect(await records.getWaitlist()).toEqual({
      count: 42,
      joined: true,
      source: "online",
    });
  });

  it("reuses one persisted interest token for two tab sessions", async () => {
    const ids = new Set<string>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        if (init.method === "POST") {
          ids.add(JSON.parse(init.body as string).id);
          return new Response(null, { status: 201 });
        }
        return new Response(null, {
          headers: { "content-range": `0-0/${ids.size}` },
        });
      }),
    );
    const firstTab = await import("./records");
    await firstTab.getWaitlist();
    vi.resetModules();
    const secondTab = await import("./records");
    await secondTab.getWaitlist();
    await firstTab.joinWaitlist();
    expect(await secondTab.joinWaitlist()).toEqual({
      count: 1,
      joined: true,
      source: "online",
    });
  });
});

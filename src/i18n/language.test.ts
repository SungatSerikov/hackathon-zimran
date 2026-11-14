import { afterEach, describe, expect, it, vi } from "vitest";
import { persistLanguage, readLanguage } from "./language";

afterEach(() => vi.unstubAllGlobals());

describe("language preference", () => {
  it("uses English for a missing or unsupported preference", () => {
    for (const saved of [null, "", "fr", "RU", "null"]) {
      vi.stubGlobal("localStorage", { getItem: () => saved });
      expect(readLanguage()).toBe("en");
    }
  });
  it("persists either choice without touching investigation storage", () => {
    const values = new Map([["case-desk:run:v1:tutorial-double-charge", "saved-progress"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    persistLanguage("ru");
    expect(readLanguage()).toBe("ru");
    persistLanguage("en");
    expect(readLanguage()).toBe("en");
    expect(values.get("case-desk:run:v1:tutorial-double-charge")).toBe("saved-progress");
    expect(values.size).toBe(2);
  });
  it("supports session switching when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
    });
    expect(readLanguage()).toBe("en");
    expect(() => persistLanguage("ru")).not.toThrow();
  });
});

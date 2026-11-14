export type Language = "en" | "ru";
const key = "case-desk:language";

export function readLanguage(): Language {
  try {
    return globalThis.localStorage.getItem(key) === "ru" ? "ru" : "en";
  } catch {
    return "en";
  }
}

export function persistLanguage(language: Language): void {
  try { globalThis.localStorage.setItem(key, language); } catch { /* Session switching still works. */ }
}

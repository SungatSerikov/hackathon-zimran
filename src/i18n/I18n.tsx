import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { persistLanguage, readLanguage, type Language } from "./language";

const I18nContext = createContext({
  language: "en" as Language,
  locale: "en-US",
  setLanguage: (_language: Language) => {},
  t: (en: string, _ru: string) => en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readLanguage);
  useEffect(() => {
    persistLanguage(language);
    document.documentElement.lang = language;
    document.title = language === "ru" ? "Case Desk — Каждая деталь важна" : "Case Desk — Every detail tells a story";
  }, [language]);
  return <I18nContext.Provider value={{ language, setLanguage,
    locale: language === "ru" ? "ru-RU" : "en-US",
    t: (en, ru) => language === "ru" ? ru : en,
  }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

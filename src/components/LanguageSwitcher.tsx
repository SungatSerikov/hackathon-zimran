import { useI18n } from "../i18n/I18n";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  return <div className="language-switch" role="group" aria-label={t("Language", "Язык")}>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === "en"}
      onClick={() => setLanguage("en")}>EN</button>
    <button type="button" lang="ru" aria-label="Русский" aria-pressed={language === "ru"}
      onClick={() => setLanguage("ru")}>РУ</button>
  </div>;
}

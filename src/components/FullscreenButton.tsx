import { useEffect, useState } from "react";
import { Icon } from "./Icons";
import { useI18n } from "../i18n/I18n";

/** Fullscreen the document so every game dialog stays in the same screen. */
export function FullscreenButton() {
  const { t } = useI18n();
  const [active, setActive] = useState(() => !!document.fullscreenElement);
  const [error, setError] = useState(false);
  const supported = !!document.fullscreenEnabled;
  useEffect(() => {
    const sync = () => { setActive(!!document.fullscreenElement); setError(false); };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(false), 6000);
    return () => window.clearTimeout(timeout);
  }, [error]);
  async function toggle() {
    setError(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError(true);
    }
  }
  const label = !supported ? t("Fullscreen unavailable in this browser", "Полноэкранный режим недоступен в этом браузере") : active ? t("Exit fullscreen", "Выйти из полноэкранного режима") : t("Enter fullscreen", "На весь экран");
  return <div className="fullscreen-control">
    <button className="fullscreen-button" onClick={toggle} disabled={!supported}
      aria-label={label} title={label} aria-pressed={active}>
      <Icon name={active ? "fullscreen-exit" : "fullscreen"} size={20} />
    </button>
    {error && <p className="fullscreen-error" role="status">{t("Fullscreen could not open. Try your browser’s fullscreen control.", "Не удалось открыть полноэкранный режим. Попробуйте включить его в меню браузера.")}</p>}
  </div>;
}

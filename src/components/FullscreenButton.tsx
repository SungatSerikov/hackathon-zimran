import { useEffect, useState } from "react";
import { Icon } from "./Icons";

/** Fullscreen the document so every game dialog stays in the same screen. */
export function FullscreenButton() {
  const [active, setActive] = useState(() => !!document.fullscreenElement);
  const [error, setError] = useState("");
  const supported = !!document.fullscreenEnabled;
  useEffect(() => {
    const sync = () => { setActive(!!document.fullscreenElement); setError(""); };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [error]);
  async function toggle() {
    setError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError("Fullscreen could not open. Try your browser’s fullscreen control.");
    }
  }
  const label = !supported ? "Fullscreen unavailable in this browser" : active ? "Exit fullscreen" : "Enter fullscreen";
  return <div className="fullscreen-control">
    <button className="fullscreen-button" onClick={toggle} disabled={!supported}
      aria-label={label} title={label} aria-pressed={active}>
      <Icon name={active ? "fullscreen-exit" : "fullscreen"} size={20} />
    </button>
    {error && <p className="fullscreen-error" role="status">{error}</p>}
  </div>;
}

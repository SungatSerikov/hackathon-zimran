import { useEffect, useState } from "react";
import { cases } from "./cases";
import { Desk } from "./screens/Desk";
import { TitleScreen, CaseFiles } from "./screens/GameMenu";
import { Scene } from "./components/Scene";
import { Icon } from "./components/Icons";
import { Dialog } from "./components/Dialog";
import { loadRun, clearRun, safeRead, safeWrite } from "./lib/storage";
import { getWaitlist, joinWaitlist } from "./lib/records";
import { recordVisit } from "./lib/streak";
import { useGameAudio, type GameSound } from "./lib/gameAudio";
import type { CaseData } from "./types";

export default function App() {
  const [screen, setScreen] = useState<"menu" | "cases" | "desk" | "duel">(
    "menu",
  );
  const [selected, setSelected] = useState(cases[0]);
  const [sessionKey, setSessionKey] = useState(0);
  const [modal, setModal] = useState<"how" | "pass" | null>(null);
  const [restart, setRestart] = useState<CaseData | null>(null);
  const sound = useGameAudio();
  useEffect(() => {
    recordVisit();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        screen !== "desk" &&
        !document.querySelector("dialog[open]")
      )
        setScreen("menu");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);
  const activeId = safeRead<unknown>("case-desk:active", "");
  const activeCase =
    cases.find((c) => c.id === activeId && loadRun(c)?.status === "playing") ||
    cases.find((c) => loadRun(c)?.status === "playing");
  function play(c: CaseData) {
    safeWrite("case-desk:active", c.id);
    setSelected(c);
    setSessionKey((k) => k + 1);
    setScreen("desk");
  }
  function replay(c: CaseData) {
    clearRun(c.id);
    setRestart(null);
    play(c);
  }
  return (
    <div
      className={`game-shell game-screen-${screen}`}
      onClickCapture={(e) => {
        const button = (e.target as HTMLElement).closest("button");
        if (button && !button.disabled)
          sound.play((button.dataset.sound || "click") as GameSound);
      }}
    >
      {screen !== "desk" && (
        <>
          <div className="menu-world" aria-hidden="true">
            <Scene hero />
            <div className="world-shade" />
          </div>
          <div className="game-utilities">
            <span>
              <i className="status-dot" /> RIVERTON CONSUMER AFFAIRS
            </span>
            <button
              className="sound-switch"
              onClick={sound.toggle}
              aria-pressed={sound.enabled}
            >
              <Icon name="sound" size={16} />
              {sound.enabled ? "SOUND ON" : "SOUND OFF"}
            </button>
          </div>
        </>
      )}
      {screen === "menu" && (
        <TitleScreen
          onCases={() => setScreen("cases")}
          onContinue={activeCase ? () => play(activeCase) : undefined}
          continueTitle={activeCase?.title}
          onHelp={() => setModal("how")}
          onDuel={() => setScreen("duel")}
          onPass={() => setModal("pass")}
        />
      )}
      {screen === "cases" && (
        <CaseFiles
          cases={cases}
          onPlay={play}
          onReplay={setRestart}
          onBack={() => setScreen("menu")}
          onPass={() => setModal("pass")}
        />
      )}
      {screen === "desk" && (
        <Desk
          key={`${selected.id}-${sessionKey}`}
          caseData={selected}
          onExit={() => setScreen("cases")}
          onNext={() =>
            selected.difficulty === 1 ? play(cases[1]) : setScreen("cases")
          }
          onPaywall={() => setModal("pass")}
          externallyPaused={!!modal}
          soundEnabled={sound.enabled}
          onSound={sound.toggle}
          playSound={sound.play}
        />
      )}
      {screen === "duel" && <Duel onBack={() => setScreen("cases")} />}
      {modal === "how" && (
        <Dialog
          title="Your first shift, explained."
          onClose={() => setModal(null)}
        >
          <ol className="how-to-list">
            <li>
              <strong>Open the case folder.</strong> Read the complaint and the
              first documents. Notice names, dates, and reference numbers.
            </li>
            <li>
              <strong>Use the archive.</strong> Type those clues into the
              computer to discover new records. Everything you need is inside
              the game.
            </li>
            <li>
              <strong>Pin your evidence.</strong> Keep useful documents on your
              board, then compare the stories.
            </li>
            <li>
              <strong>Make your call.</strong> Approve or deny the complaint.
              Name the culprit, explain how, and support it with two records.
            </li>
          </ol>
          <button
            className="button"
            onClick={() => {
              setModal(null);
              play(cases[0]);
            }}
          >
            Start the guided case
            <Icon name="arrow" />
          </button>
        </Dialog>
      )}
      {modal === "pass" && (
        <Dialog
          title="For the endlessly curious."
          label="DETECTIVE PASS · COMING LATER"
          onClose={() => setModal(null)}
        >
          <div className="pass-panel">
            <span className="pass-emblem">
              <Icon name="star" size={44} />
            </span>
            <p>More stories to untangle. One small monthly ritual.</p>
            <div className="pass-price">
              $4.99<span>/ month · planned price</span>
            </div>
            <ul>
              <li>
                <Icon name="check" size={17} />
                The full archive of investigations
              </li>
              <li>
                <Icon name="check" size={17} />
                New cases every week
              </li>
              <li>
                <Icon name="check" size={17} />
                Author’s notes and case breakdowns
              </li>
              <li>
                <Icon name="check" size={17} />
                Unlimited informant hints
              </li>
              <li>
                <Icon name="check" size={17} />
                Private leagues with friends
              </li>
            </ul>
            <p className="cash-pack">
              Optional cash pack · $500 bureau cash for $1.99
              <br />
              <small>Planned only. Not available for purchase.</small>
            </p>
            <button className="button" disabled>
              Subscriptions are not available yet
            </button>
            <p className="fine-print">
              This is a preview of the planned subscription. The two demo cases
              are free. No payment is collected.
            </p>
          </div>
        </Dialog>
      )}
      {restart && (
        <Dialog title="Start this case again?" onClose={() => setRestart(null)}>
          <p className="panel-intro">
            This replaces your current attempt at{" "}
            <strong>{restart.title}</strong>. Your best score stays in the
            register.
          </p>
          <div className="panel-actions">
            <button
              className="button secondary"
              onClick={() => setRestart(null)}
            >
              Keep current attempt
            </button>
            <button className="button" onClick={() => replay(restart)}>
              Start fresh
              <Icon name="arrow" />
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function Duel({ onBack }: { onBack: () => void }) {
  const [interest, setInterest] = useState({
    count: 0,
    joined: false,
    source: "local" as "local" | "online",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void getWaitlist()
      .then((r) => {
        if (active) setInterest(r);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function join() {
    if (busy || interest.joined) return;
    setBusy(true);
    try {
      setInterest(await joinWaitlist());
    } catch {
      setError("Could not save your interest. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="duel-page page-enter">
      <span className="badge">IN DEVELOPMENT</span>
      <div className="duel-art">
        <span>
          <Icon name="search" size={42} />
        </span>
        <strong>VS</strong>
        <span>
          <Icon name="search" size={42} />
        </span>
      </div>
      <h1>
        Same case.
        <br />
        <em>Two sharp minds.</em>
      </h1>
      <p>
        A future head-to-head mode: investigate the same file, follow your own
        trail, and see who can support the right conclusion first.
      </p>
      <div className="duel-rule">
        <Icon name="clock" />
        <span>
          The first submission starts a short countdown for the other detective.
        </span>
      </div>
      <button
        className="button"
        disabled={interest.joined || busy}
        onClick={() => void join()}
      >
        {busy
          ? "Recording…"
          : interest.joined
            ? "Interest recorded"
            : "I’d play this"}
        <Icon name={interest.joined ? "check" : "arrow"} />
      </button>
      <span className="interest-count">
        {interest.source === "online"
          ? `${interest.count} detectives have registered interest`
          : interest.joined
            ? "Your interest is saved in this browser."
            : "Interest tracking is local to this browser."}
      </span>
      <p className="fine-print">
        Duels are not playable yet. This button records interest; it does not
        subscribe you to notifications.
      </p>
      {error && <p role="alert">{error}</p>}
      <button className="text-button" onClick={onBack}>
        <Icon name="back" size={16} />
        Play a solo case
      </button>
    </main>
  );
}

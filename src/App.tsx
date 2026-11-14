import { useEffect, useState } from "react";
import { cases } from "./cases";
import { Desk } from "./screens/Desk";
import { Scene } from "./components/Scene";
import { Icon } from "./components/Icons";
import { Dialog } from "./components/Dialog";
import { loadRun, clearRun, safeRead } from "./lib/storage";
import { getWaitlist, joinWaitlist } from "./lib/records";
import { recordVisit } from "./lib/streak";
import type { CaseData } from "./types";

export default function App() {
  const [screen, setScreen] = useState<"menu" | "cases" | "desk" | "duel">(
    "menu",
  );
  const [selected, setSelected] = useState(cases[0]);
  const [sessionKey, setSessionKey] = useState(0);
  const [modal, setModal] = useState<"how" | "pass" | null>(null);
  const [restart, setRestart] = useState<CaseData | null>(null);
  const [streak, setStreak] = useState(1);
  useEffect(() => {
    setStreak(recordVisit());
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  function play(c: CaseData) {
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
    <div className="app-shell">
      <header className="app-header">
        <button
          className="brand"
          onClick={() => setScreen("menu")}
          aria-label="Case Desk home"
        >
          <span className="brand-mark">
            <Icon name="folder" size={23} />
          </span>
          <strong>
            CASE DESK<span>RIVERTON CONSUMER AFFAIRS</span>
          </strong>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={screen === "cases" ? "active" : ""}
            onClick={() => setScreen("cases")}
          >
            Case files
          </button>
          <button
            className={screen === "duel" ? "active" : ""}
            onClick={() => setScreen("duel")}
          >
            Duels <span className="soon-tag">SOON</span>
          </button>
          <button className="pass-nav" onClick={() => setModal("pass")}>
            <Icon name="star" size={15} />
            Detective Pass
          </button>
        </nav>
        <span className="header-streak">
          <span className="status-dot" />
          {streak} DAY{streak === 1 ? "" : "S"} ON THE CASE
        </span>
      </header>
      {screen === "menu" && (
        <main className="home-page page-enter">
          <div className="home-topline">
            <span className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY.</span>
            <span className="eyebrow">EST. 2026 / OPEN FOR INVESTIGATION</span>
          </div>
          <section className="home-hero">
            <div className="home-copy">
              <span className="office-tag">
                <i />
                WELCOME TO YOUR DESK
              </span>
              <h1>
                Something
                <br />
                doesn’t
                <br />
                <em>add up.</em>
              </h1>
              <p>
                A suspicious charge. A missing package.
                <br />
                Everyday mysteries, waiting for a sharp eye.
              </p>
              <button
                className="button primary-cta"
                onClick={() => setScreen("cases")}
              >
                Take a case
                <Icon name="arrow" />
              </button>
              <button
                className="text-button how-button"
                onClick={() => setModal("how")}
              >
                <Icon name="help" size={16} />
                First day? Here’s how it works
              </button>
              <div className="home-meta">
                <span>
                  <Icon name="clock" size={15} />
                  5–15 minute cases
                </span>
                <span>No sign-up needed</span>
              </div>
            </div>
            <div className="home-scene">
              <div className="scene-top-strip">
                <span>YOUR OFFICE, AFTER HOURS</span>
                <i />
                <i />
                <i />
              </div>
              <Scene hero />
              <div className="scene-caption">
                <span>01 / READ THE FILE</span>
                <span>02 / FOLLOW THE CLUES</span>
                <span>03 / MAKE THE CALL</span>
              </div>
              <div className="desk-note">
                <Icon name="pin" size={18} />
                <span>
                  Trust the evidence.
                  <br />
                  <strong>Not the first story.</strong>
                </span>
              </div>
            </div>
          </section>
          <div className="home-footer-row">
            <div>
              <span className="eyebrow">ON YOUR DESK TODAY</span>
              <strong>Two stories. A few loose threads.</strong>
            </div>
            <button className="text-button" onClick={() => setScreen("cases")}>
              Browse the case files
              <Icon name="arrow" size={17} />
            </button>
          </div>
          <div className="home-case-teasers">
            {cases.map((c, i) => (
              <button key={c.id} onClick={() => play(c)}>
                <span className="file-number">0{i + 1}</span>
                <div>
                  <span className="eyebrow">
                    {i === 0
                      ? "START HERE · GUIDED CASE"
                      : "THE NEXT ASSIGNMENT"}
                  </span>
                  <h2>{c.title}</h2>
                </div>
                <span className="case-teaser-time">{c.estMinutes} MIN</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </main>
      )}
      {screen === "cases" && (
        <main className="case-list-page page-enter">
          <div className="section-heading">
            <div>
              <span className="eyebrow">RCA / INVESTIGATIONS DEPARTMENT</span>
              <h1>The case files.</h1>
              <p>Somebody has a story. Find out if it holds up.</p>
            </div>
            <span className="paper-label">
              2 OPEN FILES
              <br />
              <small>YOUR NEXT SHIFT STARTS HERE</small>
            </span>
          </div>
          <div className="case-grid">
            {cases.map((c, i) => {
              const run = loadRun(c);
              const best = safeRead<unknown>(`case-desk:best:${c.id}`, 0);
              return (
                <article
                  className={`case-card ${i === 0 ? "tutorial-card" : ""}`}
                  key={c.id}
                >
                  <div className="file-illustration">
                    <div className="file-tab">
                      FILE {String(i + 1).padStart(3, "0")}
                    </div>
                    <div className="case-illustration-icon">
                      <Icon name={i === 0 ? "file" : "search"} size={58} />
                    </div>
                    <span className="file-illustration-stamp">
                      {i === 0 ? "TRAINING" : "OPEN CASE"}
                    </span>
                    <span className="illustration-lines" />
                  </div>
                  <div className="case-card-content">
                    <div className="case-card-meta">
                      <span className="badge">
                        {i === 0 ? "GUIDED TUTORIAL" : "STANDARD CASE"}
                      </span>
                      <span>
                        {c.estMinutes} MIN · {"●".repeat(c.difficulty)}
                        {"○".repeat(3 - c.difficulty)}
                      </span>
                    </div>
                    <h2>{c.title}</h2>
                    <p>
                      {i === 0
                        ? "Two charges. One repair. Learn to follow a paper trail and uncover what really happened."
                        : "The jacket was returned. The refund never came. Someone along the way is hiding a detail."}
                    </p>
                    {run?.status === "solved" && (
                      <span className="case-best">
                        <Icon name="check" size={15} />
                        Solved · best {typeof best === "number" ? best : 0} pts
                      </span>
                    )}
                    <button className="button" onClick={() => play(c)}>
                      {run?.status === "playing"
                        ? "Continue investigation"
                        : run
                          ? "View case result"
                          : i === 0
                            ? "Learn the ropes"
                            : "Investigate"}
                      <Icon name="arrow" />
                    </button>
                    {run && (
                      <button
                        className="text-button replay-button"
                        onClick={() => setRestart(c)}
                      >
                        Start a fresh attempt
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            <article className="case-card premium-card">
              <div className="premium-illustration">
                <Icon name="lock" size={48} />
                <span>THE ARCHIVE</span>
                <div className="premium-spines">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="case-card-content">
                <span className="badge">DETECTIVE PASS · PLANNED</span>
                <h2>There’s always another story.</h2>
                <p>
                  The Subscription Trap. The Perfect Tenant. New files and
                  larger mysteries are on the drawing board.
                </p>
                <div className="premium-file-list">
                  {["The Subscription Trap", "The Perfect Tenant"].map(
                    (title) => (
                      <button key={title} onClick={() => setModal("pass")}>
                        <Icon name="lock" size={13} /> {title}{" "}
                        <span>PLANNED</span>
                      </button>
                    ),
                  )}
                </div>
                <button
                  className="button secondary"
                  onClick={() => setModal("pass")}
                >
                  Explore Detective Pass
                  <Icon name="lock" size={16} />
                </button>
              </div>
            </article>
          </div>
          <p className="case-list-note">
            <Icon name="coffee" size={18} />
            Three attempts per case. Your progress saves automatically on this
            device.
          </p>
        </main>
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
        />
      )}
      {screen === "duel" && <Duel onBack={() => setScreen("cases")} />}
      <footer className="app-footer">
        <span>
          CASE DESK <span className="muted">/</span> FICTIONAL CASES. REAL
          CURIOSITY.
        </span>
        <span>BUSINESS CUP 2.0 · PLAYABLE DEMO</span>
      </footer>
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

import { Icon } from "../components/Icons";
import { Asset } from "../components/Scene";
import type { CaseData } from "../types";
import { loadRun, safeRead } from "../lib/storage";

export function TitleScreen({
  onCases,
  onContinue,
  onHelp,
  onDuel,
  onPass,
  continueTitle,
}: {
  onCases: () => void;
  onContinue?: () => void;
  onHelp: () => void;
  onDuel: () => void;
  onPass: () => void;
  continueTitle?: string;
}) {
  return (
    <main className="title-screen">
      <div className="title-content">
        <p className="title-kicker">
          <span /> RIVERTON · AFTER HOURS
        </p>
        <h1>
          CASE
          <span>
            DESK<span className="title-period">.</span>
          </span>
        </h1>
        <p className="title-tagline">
          Everyone has a story.
          <br />
          The evidence has another.
        </p>
        <nav className="title-options" aria-label="Game menu">
          {onContinue && (
            <button className="menu-choice main-choice" onClick={onContinue}>
              <span className="menu-arrow">▶</span>
              <span>
                Continue<small>{continueTitle}</small>
              </span>
            </button>
          )}
          <button
            className={`menu-choice ${!onContinue ? "main-choice" : ""}`}
            onClick={onCases}
          >
            <span className="menu-arrow">▶</span>
            <span>
              {onContinue ? "Case files" : "Start investigating"}
              <small>Two cases. A desk full of loose ends.</small>
            </span>
          </button>
          <button className="menu-choice" onClick={onHelp}>
            <span className="menu-arrow">▶</span>How to play
          </button>
          <button className="menu-choice" onClick={onDuel}>
            <span className="menu-arrow">▶</span>Detective duels{" "}
            <span className="menu-soon">SOON</span>
          </button>
          <button className="menu-choice menu-pass" onClick={onPass}>
            <span className="menu-arrow">▶</span>Detective Pass{" "}
            <Icon name="lock" size={13} />
          </button>
        </nav>
      </div>
      <div className="title-caption">
        <span className="status-dot" /> YOUR NEXT CASE IS WAITING.
      </div>
      <span className="game-edition">A PIXEL DETECTIVE GAME · DEMO 01</span>
    </main>
  );
}

export function CaseFiles({
  cases,
  onPlay,
  onReplay,
  onBack,
  onPass,
}: {
  cases: CaseData[];
  onPlay: (c: CaseData) => void;
  onReplay: (c: CaseData) => void;
  onBack: () => void;
  onPass: () => void;
}) {
  return (
    <main className="case-selection">
      <header className="selection-heading">
        <button className="game-back" onClick={onBack}>
          <Icon name="back" size={17} /> Main menu
        </button>
        <span>RCA / ASSIGNMENTS</span>
      </header>
      <div className="selection-title">
        <span className="eyebrow">THE IN-TRAY</span>
        <h1>Choose your next case.</h1>
        <p>Read the story. Follow the paper trail. Make your call.</p>
      </div>
      <div className="dossier-row">
        {cases.map((c, i) => {
          const run = loadRun(c);
          const client =
            c.characters.find(
              (person) => person.id === c.claim.claimant,
            ) || c.characters[0];
          const best = safeRead<unknown>(`case-desk:best:${c.id}`, 0);
          return (
            <article className={`dossier dossier-${i}`} key={c.id}>
              <div className="dossier-tab">
                FILE 00{i + 1} / {i === 0 ? "TRAINING" : "OPEN CASE"}
              </div>
              <div className="dossier-top">
                <Asset
                  src={`/assets/portraits/${client.portrait}`}
                  className="dossier-photo"
                >
                  <span>{client.name[0]}</span>
                </Asset>
                <div>
                  <span className="eyebrow">COMPLAINANT</span>
                  <strong>{client.name}</strong>
                  <span className="dossier-status">
                    {run?.status === "solved"
                      ? "CASE CLOSED"
                      : "AWAITING REVIEW"}
                  </span>
                </div>
                <span className="paperclip" aria-hidden="true" />
              </div>
              <h2>{c.title}</h2>
              <p>
                {i === 0
                  ? "One repair. Two charges. Someone is counting on you not checking the paperwork."
                  : "A returned jacket. A missing refund. Follow the package — someone along the way is lying."}
              </p>
              <div className="dossier-meta">
                <span>
                  <Icon name="clock" size={14} />
                  {c.estMinutes} MIN
                </span>
                <span>{i === 0 ? "GUIDED CASE" : "● ● ○"}</span>
              </div>
              {run?.status === "solved" && (
                <p className="dossier-best">
                  Best report: {typeof best === "number" ? best : 0} points
                </p>
              )}
              <button
                className="dossier-play"
                data-sound="paper"
                onClick={() => onPlay(c)}
              >
                {run?.status === "playing"
                  ? "Continue investigation"
                  : run
                    ? "View case result"
                    : "Accept case"}
                <Icon name="arrow" size={18} />
              </button>
              {run && (
                <button className="dossier-replay" onClick={() => onReplay(c)}>
                  Start a fresh attempt
                </button>
              )}
            </article>
          );
        })}
      </div>
      <button className="archive-seal" onClick={onPass}>
        <Icon name="lock" size={16} />
        <span>
          MORE FILES IN THE ARCHIVE<small>Detective Pass · coming later</small>
        </span>
        <Icon name="arrow" size={16} />
      </button>
    </main>
  );
}

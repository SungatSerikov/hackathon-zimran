import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Accusation, CaseData, CaseDocument, Verdict } from "../types";
import { gameReducer, createRun } from "../store/game";
import { loadRun, saveRun, safeRead, safeWrite } from "../lib/storage";
import { getStreak } from "../lib/streak";
import { Icon } from "../components/Icons";
import { Dialog } from "../components/Dialog";
import { DocumentView, docLabels } from "../components/DocumentView";
import { RecordsComputer } from "../components/RecordsComputer";
import { Scene, Asset, formatTime, type DeskAction } from "../components/Scene";
import { Result } from "./Result";
import { EconomyPanel, bureauMoney } from "../components/EconomyPanel";
import { getWallet } from "../engine/wallet";
import type { GameSound } from "../lib/gameAudio";
import { FullscreenButton } from "../components/FullscreenButton";
import sceneLayout from "../scene/layout.json";

type Panel =
  | "briefing"
  | "pause"
  | "folder"
  | "search"
  | "board"
  | "verdict"
  | "verdict-feedback"
  | "calendar"
  | "help"
  | "wallet"
  | "hint"
  | null;
export function Desk({
  caseData,
  onExit,
  onNext,
  onPaywall,
  externallyPaused = false,
  soundEnabled,
  onSound,
  playSound,
}: {
  caseData: CaseData;
  onExit: () => void;
  onNext: () => void;
  onPaywall: () => void;
  externallyPaused?: boolean;
  soundEnabled: boolean;
  onSound: () => void;
  playSound: (kind: GameSound) => void;
}) {
  const [run, dispatch] = useReducer(
    gameReducer,
    caseData,
    (c) => loadRun(c) || createRun(c),
  );
  const [panel, setPanel] = useState<Panel>(() =>
    run.elapsedSeconds === 0 && !run.seenIds.length && !run.queries.length
      ? "briefing"
      : null,
  );
  const [hotspots, setHotspots] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(() =>
    !run.seenIds.length && !run.queries.length && safeRead<boolean>("case-desk:show-guide", true) !== false,
  );
  const client =
    caseData.characters.find((c) => c.id === caseData.claim.claimant) ||
    caseData.characters[0];
  const paused =
    externallyPaused ||
    panel === "pause" ||
    panel === "briefing" ||
    panel === "help" ||
    panel === "verdict-feedback";
  const [balance, setBalance] = useState(() => getWallet().balance);
  const [selected, setSelected] = useState(
    caseData.documents.find((d) => d.initial)?.id || "",
  );
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [culprit, setCulprit] = useState("");
  const [method, setMethod] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [submitLock, setSubmitLock] = useState(false);
  const prevWrong = useRef(run.wrongAttempts);
  const documents = caseData.documents.filter((d) =>
    run.openedIds.includes(d.id),
  );
  const selectedDoc = documents.find((d) => d.id === selected) || documents[0];
  const pinned = documents.filter((d) => run.pinnedIds.includes(d.id));
  const tutorial = caseData.difficulty === 1;
  const initialRead = run.seenIds.some(
    (id) => caseData.documents.find((d) => d.id === id)?.initial,
  );
  const tutorialStep = !initialRead
    ? 0
    : run.queries.length === 0
      ? 1
      : pinned.length < 2
        ? 2
        : 3;
  const guidance = [
    "Start with the case folder. Read the complaint and look for a company name or reference number.",
    "Open the computer. Read a record and click a highlighted name or number to search it.",
    "Open a search result inside the computer. Follow its highlighted details and pin two records that prove what happened.",
    "Ready to decide? Open Verdict. Choose a stamp, a person, an explanation, and two pinned documents.",
  ];
  const previousStep = useRef(tutorialStep);
  useEffect(() => {
    if (previousStep.current !== tutorialStep) setGuideExpanded(false);
    previousStep.current = tutorialStep;
  }, [tutorialStep]);
  function toggleGuide(expanded: boolean) {
    setGuideExpanded(expanded);
    safeWrite("case-desk:show-guide", expanded);
  }
  useEffect(() => {
    setStorageFailed(!saveRun(run));
  }, [run]);
  useEffect(() => {
    if (run.status !== "playing" || paused) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const seconds = Math.floor((now - last) / 1000);
      if (seconds > 0) {
        dispatch({ type: "tick", seconds });
        last += seconds * 1000;
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [run.status, paused]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (run.wrongAttempts > prevWrong.current) {
      // Native dialogs sit above every page toast. Show the outcome in its
      // own modal so it remains visible until the player acknowledges it.
      if (run.status === "playing") setPanel("verdict-feedback");
      setConfirming(false);
      setSubmitLock(true);
    }
    prevWrong.current = run.wrongAttempts;
  }, [run.wrongAttempts, run.status]);
  useEffect(() => {
    setConfirming(false);
    setSubmitLock(false);
  }, [verdict, culprit, method, evidence]);
  useEffect(() => {
    setEvidence((prev) => prev.filter((id) => run.pinnedIds.includes(id)));
  }, [run.pinnedIds]);
  const close = () => setPanel(null);
  function openDoc(doc: CaseDocument) {
    setSelected(doc.id);
    dispatch({ type: "read", documentId: doc.id });
    setPanel("folder");
  }
  function openFolder() {
    if (selectedDoc) dispatch({ type: "read", documentId: selectedDoc.id });
    setPanel("folder");
  }
  function pin(id: string) {
    playSound("pin");
    dispatch({ type: "pin", documentId: id });
    setToast(
      run.pinnedIds.includes(id)
        ? "Document removed from your board."
        : "Evidence pinned to your board.",
    );
  }
  function action(id: DeskAction) {
    playSound(
      id === "folder" ? "paper" : id === "monitor" ? "record" : "click",
    );
    if (id === "monitor") setPanel("search");
    if (id === "folder") openFolder();
    if (id === "board") setPanel("board");
    if (id === "stamps") setPanel("verdict");
    if (id === "safe") setPanel("wallet");
    if (id === "phone") setPanel("hint");
    if (id === "cabinet") onPaywall();
    if (id === "calendar") setPanel("calendar");
    if (id === "coffee")
      setToast(
        `${3 - run.wrongAttempts} attempts left. Each incorrect verdict costs a coffee and adds 60 seconds.`,
      );
    if (id === "clock")
      setToast(
        "Take your time. Accuracy matters. The clock pauses when you return to the case list.",
      );
  }
  function search(value: string) {
    const clean = value.trim();
    if (!clean) return;
    dispatch({ type: "search", caseData, query: clean });
    playSound("record");
    setQuery(clean);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        run.status !== "playing" ||
        externallyPaused ||
        panel ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.querySelector("dialog[open]")
      )
        return;
      if (
        (e.target as HTMLElement).closest(
          "input, textarea, select, [contenteditable=true]",
        )
      )
        return;
      const key = e.key.toLowerCase();
      const actions: Record<string, DeskAction> = {
        f: "folder",
        a: "monitor",
        e: "board",
        v: "stamps",
        h: "phone",
      };
      if (key === "escape") {
        // The browser owns Escape while fullscreen is active.
        if (document.fullscreenElement) return;
        e.preventDefault();
        setPanel("pause");
      } else if (actions[key]) {
        e.preventDefault();
        action(actions[key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const ready = !!verdict && !!culprit && !!method && evidence.length === 2;
  const accusation = useMemo(
    () =>
      ({
        verdict: verdict || "GUILTY",
        culprit,
        method,
        evidence,
      }) as Accusation,
    [verdict, culprit, method, evidence],
  );
  const sameAsLast =
    run.lastAccusation &&
    JSON.stringify({
      ...run.lastAccusation,
      evidence: [...run.lastAccusation.evidence].sort(),
    }) ===
      JSON.stringify({
        ...accusation,
        evidence: [...accusation.evidence].sort(),
      });
  if (run.status !== "playing")
    return (
      <Result caseData={caseData} run={run} onExit={onExit} onNext={onNext} />
    );
  return (
    <main className={`investigation ${panel ? "object-open" : ""}`}>
      <header className="game-hud">
        <button
          className="hud-menu"
          onClick={() => setPanel("pause")}
          aria-label="Pause game"
        >
          <span aria-hidden="true">Ⅱ</span>
          <kbd>ESC</kbd>
        </button>
        <div className="hud-case">
          <span>{tutorial ? "TRAINING / 001" : "CASE / 002"}</span>
          <h1>{caseData.title}</h1>
        </div>
        <div
          className="hud-clock"
          aria-label={`Elapsed time ${formatTime(run.elapsedSeconds)}`}
        >
          <Icon name="clock" size={16} />
          <strong>{formatTime(run.elapsedSeconds)}</strong>
        </div>
        <div
          className="hud-lives"
          aria-label={`${3 - run.wrongAttempts} attempts remaining`}
        >
          {[0, 1, 2].map((i) => (
            <Icon
              key={i}
              name="coffee"
              size={20}
              style={{ opacity: i < 3 - run.wrongAttempts ? 1 : 0.2 }}
            />
          ))}
        </div>
        <button
          className="hud-wallet"
          onClick={() => setPanel("wallet")}
          aria-label={`Bureau cash ${bureauMoney(balance)}`}
        >
          <Icon name="lock" size={14} />
          {bureauMoney(balance)}
        </button>
        <button
          className="hud-sound"
          onClick={onSound}
          aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
          aria-pressed={soundEnabled}
        >
          <Icon name="sound" size={18} />
          {!soundEnabled && <i />}
        </button>
        <FullscreenButton />
      </header>
      <div className="office-stage">
        <div className="office-backdrop" aria-hidden="true">
          <Asset src={`/assets/${sceneLayout.background}`} />
        </div>
        <Scene
          onAction={action}
          elapsed={run.elapsedSeconds}
          lives={3 - run.wrongAttempts}
          evidence={pinned.length}
          balance={balance}
          date={caseData.gameDate || caseData.worldDate}
          showHotspots={hotspots}
          highlight={
            tutorial && guideExpanded
              ? ["folder", "monitor", "folder", "stamps"][tutorialStep]
              : undefined
          }
        />
      </div>
      <div className="desk-instructions">
        {tutorial && guideExpanded ? (
          <div className="field-note" id="tutorial-guidance">
            <div className="field-note-heading">
              <span>FIELD NOTE {tutorialStep + 1}/4</span>
              <button onClick={() => toggleGuide(false)} aria-label="Hide tutorial hint"><Icon name="close" size={14} /></button>
            </div>
            <p>{guidance[tutorialStep]}</p>
          </div>
        ) : !tutorial ? (
          <span className="room-caption">
            Your desk. Your investigation.
            <small>Click an object to examine it.</small>
          </span>
        ) : null}
        <div className="desk-assistance">
          {tutorial && <button className="guide-toggle" aria-expanded={guideExpanded}
            aria-controls={guideExpanded ? "tutorial-guidance" : undefined} onClick={() => toggleGuide(!guideExpanded)}>
            <Icon name="help" size={14} /> Tutorial hint
          </button>}
        <button
          className="hotspot-toggle"
          aria-pressed={hotspots}
          onClick={() => setHotspots((v) => !v)}
        >
          <Icon name="search" size={14} />
          {hotspots ? "Hide labels" : "Show objects"}
        </button>
        </div>
      </div>
      <nav className="game-toolbelt" aria-label="Investigation tools">
        <button onClick={openFolder} data-sound="paper">
          <kbd>F</kbd>
          <Icon name="folder" />
          <span>Folder</span>
          <b>{documents.length}</b>
        </button>
        <button onClick={() => action("monitor")}>
          <kbd>A</kbd>
          <Icon name="search" />
          <span>Archive</span>
        </button>
        <button onClick={() => action("board")}>
          <kbd>E</kbd>
          <Icon name="pin" />
          <span>Evidence</span>
          <b>{pinned.length}</b>
        </button>
        <button onClick={() => action("phone")}>
          <kbd>H</kbd>
          <Icon name="phone" />
          <span>Informant</span>
        </button>
        <button className="tool-verdict" onClick={() => action("stamps")}>
          <kbd>V</kbd>
          <Icon name="stamp" />
          <span>Verdict</span>
        </button>
      </nav>
      <div
        className={`save-indicator ${storageFailed ? "save-failed" : ""}`}
        role={storageFailed ? "status" : undefined}
      >
        {storageFailed
          ? "Progress is temporary: browser storage unavailable"
          : "AUTO-SAVED"}
        <span className="status-dot" />
      </div>
      {panel === "briefing" && (
        <Dialog
          title={client.name}
          label="A CLIENT AT YOUR DESK"
          onClose={close}
          wide
          tone="briefing-dialog"
        >
          <div className="client-arrival">
            <div className="client-portrait-frame">
              <Asset
                src={`/assets/portraits/${client.portrait}`}
                className="client-portrait"
              >
                <span>{client.name[0]}</span>
              </Asset>
              <span>COMPLAINANT / {caseData.gameDate}</span>
            </div>
            <div className="client-dialogue">
              <span className="eyebrow">{caseData.title}</span>
              <blockquote>
                “{caseData.claim.statement}”
              </blockquote>
              <p>{caseData.brief}</p>
              <button className="button" data-sound="paper" onClick={close}>
                I’ll look into it.
                <Icon name="folder" size={18} />
              </button>
              <small>The case file is on your desk. Open it to begin.</small>
            </div>
          </div>
        </Dialog>
      )}
      {panel === "pause" && (
        <Dialog
          title="Take a breath, detective."
          label="SHIFT PAUSED · YOUR CLOCK IS STOPPED"
          onClose={close}
          tone="pause-dialog"
        >
          <div className="pause-options">
            <button className="button" onClick={close}>
              Resume investigation
              <Icon name="arrow" />
            </button>
            <button onClick={() => setPanel("briefing")}>
              <Icon name="people" size={18} /> Read the client’s statement
            </button>
            <button onClick={() => setPanel("help")}>
              <Icon name="help" size={18} /> How to play
            </button>
            <button onClick={onSound}>
              <Icon name="sound" size={18} />
              {soundEnabled ? "Sound: on" : "Sound: off"}
            </button>
            <button onClick={onExit}>
              <Icon name="back" size={18} /> Save & return to case files
            </button>
          </div>
          <p className="fine-print">
            Your evidence and progress stay on this device.
          </p>
        </Dialog>
      )}
      <div className="toast" role="status" aria-live="polite">
        {toast && <span>{toast}</span>}
      </div>
      {(panel === "wallet" || panel === "hint") && (
        <EconomyPanel
          mode={panel}
          caseData={caseData}
          run={run}
          onClose={close}
          onHint={(hint) => dispatch({ type: "hint", hint })}
          onBalance={setBalance}
          onSearch={(q) => {
            setQuery(q);
            setPanel("search");
          }}
          onPaywall={onPaywall}
        />
      )}
      {panel === "folder" && (
        <Dialog
          title="Case folder"
          tone="folder-dialog"
          label={`${documents.length} RECORDS ON FILE`}
          wide
          onClose={close}
        >
          <div className="folder-layout">
            <aside className="folder-sidebar">
              <p className="case-brief">{caseData.brief}</p>
              <span className="eyebrow">DOCUMENTS</span>
              <div className="document-list">
                {documents.map((d) => (
                  <button
                    key={d.id}
                    className={selectedDoc?.id === d.id ? "selected" : ""}
                    onClick={() => openDoc(d)}
                  >
                    <Icon
                      name={d.type === "chat" ? "people" : "file"}
                      size={18}
                    />
                    <span>
                      {d.title}
                      <small>{docLabels[d.type]}</small>
                    </span>
                    {run.pinnedIds.includes(d.id) ? (
                      <Icon name="pin" size={14} />
                    ) : !run.seenIds.includes(d.id) ? (
                      <i className="new-dot" title="Unread" />
                    ) : null}
                  </button>
                ))}
              </div>
              <button
                className="text-button"
                onClick={() => setPanel("search")}
              >
                <Icon name="search" size={15} />
                Find more in the archive
              </button>
            </aside>
            <div className="document-view">
              {selectedDoc && (
                <DocumentView
                  doc={selectedDoc}
                  pinned={run.pinnedIds.includes(selectedDoc.id)}
                  onPin={() => pin(selectedDoc.id)}
                />
              )}
            </div>
          </div>
        </Dialog>
      )}
      {panel === "search" && (
        <RecordsComputer
          caseData={caseData}
          run={run}
          selectedId={selected}
          query={query}
          onQuery={setQuery}
          onSearch={search}
          onSelect={(id) => {
            setSelected(id);
            dispatch({ type: "read", documentId: id });
          }}
          onRead={(id) => dispatch({ type: "read", documentId: id })}
          onPin={pin}
          onClose={close}
        />
      )}
      {panel === "board" && (
        <Dialog
          title="Your evidence board"
          tone="board-dialog"
          label={`${pinned.length} PINNED RECORDS`}
          wide
          onClose={close}
        >
          <p className="panel-intro">
            Connect the details. You will need two documents to support your
            final verdict.
          </p>
          {pinned.length ? (
            <div className="evidence-grid">
              {pinned.map((d, i) => (
                <button
                  className="evidence-card"
                  onClick={() => openDoc(d)}
                  key={d.id}
                >
                  <span className="evidence-pin" />
                  <span className="eyebrow">
                    EXHIBIT {String.fromCharCode(65 + i)}
                  </span>
                  <h3>{d.title}</h3>
                  <p>{d.text.slice(0, 140)}…</p>
                  <span className="text-button">
                    Examine record <Icon name="arrow" size={15} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Icon name="pin" size={40} />
              <h3>Every case starts with a loose thread.</h3>
              <p>
                Open a document and choose “Pin as evidence” to keep it here.
              </p>
              <button className="button" onClick={openFolder}>
                Open case folder
              </button>
            </div>
          )}
          <div className="panel-actions">
            <button
              className="button secondary"
              onClick={() => setPanel("search")}
            >
              Search the archive
            </button>
            <button className="button" onClick={() => setPanel("verdict")}>
              Make a verdict
              <Icon name="stamp" />
            </button>
          </div>
        </Dialog>
      )}
      {panel === "verdict" && (
        <Dialog
          title="Make your verdict"
          tone="verdict-dialog"
          label="FINAL REVIEW · SUPPORT YOUR CONCLUSION"
          wide
          onClose={close}
        >
          {run.wrongAttempts > 0 && (
            <div className="verdict-error-banner" role="status">
              <strong>Your previous verdict was incorrect.</strong>
              <span>
                {3 - run.wrongAttempts} {run.wrongAttempts === 2 ? "attempt" : "attempts"} remaining.
                Recheck your conclusion before submitting again.
              </span>
            </div>
          )}
          <div className="claim-paper">
            <span className="eyebrow">RIVERTON CONSUMER AFFAIRS · CLAIM #{caseData.claim.number}</span>
            <dl className="claim-details">
              <div><dt>Claimant</dt><dd>{client.name}</dd></div>
              <div><dt>Respondent</dt><dd>{caseData.claim.respondent}</dd></div>
              <div><dt>Request</dt><dd>{caseData.claim.request}</dd></div>
              {caseData.claim.amount !== undefined && (
                <div><dt>Amount</dt><dd>{bureauMoney(caseData.claim.amount)}</dd></div>
              )}
            </dl>
            <blockquote>“{caseData.claim.statement}”</blockquote>
            <p className="stamp-instruction">
              Stamp the respondent: GUILTY if they owe the claimant, NOT GUILTY if they don’t.
            </p>
            <div className="verdict-stamps">
              {(["GUILTY", "NOT_GUILTY"] as const).map((v) => (
                <button
                  className={`stamp-choice ${v.toLowerCase()} ${verdict === v ? "chosen" : ""}`}
                  key={v}
                  onClick={() => setVerdict(v)}
                  aria-pressed={verdict === v}
                >
                  {v.replaceAll("_", " ")}
                  <small>
                    {v === "GUILTY"
                      ? "Respondent owes the claimant"
                      : "Respondent is not responsible"}
                  </small>
                </button>
              ))}
            </div>
          </div>
          <fieldset className="verdict-section">
            <legend>
              <span>01</span> Who is responsible?
            </legend>
            <div className="character-options">
              {caseData.characters.map((c, i) => (
                <label key={c.id} className={culprit === c.id ? "checked" : ""}>
                  <input
                    type="radio"
                    name="culprit"
                    value={c.id}
                    checked={culprit === c.id}
                    onChange={() => setCulprit(c.id)}
                  />
                  <Asset
                    src={`/assets/portraits/${c.portrait}`}
                    className={`portrait portrait-${i}`}
                  >
                    <span>
                      {c.name
                        .split(" ")
                        .map((s) => s[0])
                        .join("")}
                    </span>
                  </Asset>
                  <span>
                    <strong>{c.name}</strong>
                    <small>{c.role}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="verdict-section">
            <legend>
              <span>02</span> What actually happened?
            </legend>
            <div className="method-options">
              {caseData.solution.methods.map((m) => (
                <label className={method === m.id ? "checked" : ""} key={m.id}>
                  <input
                    type="radio"
                    name="method"
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                  />
                  <span>{m.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="verdict-section">
            <legend>
              <span>03</span> Select exactly two supporting documents{" "}
              <small>{evidence.length}/2</small>
            </legend>
            {pinned.length < 2 && (
              <p className="notice">
                Pin at least two documents from your folder first.{" "}
                <button className="text-button" onClick={openFolder}>
                  Open folder →
                </button>
              </p>
            )}
            <div className="method-options">
              {pinned.map((d) => (
                <label
                  key={d.id}
                  className={evidence.includes(d.id) ? "checked" : ""}
                >
                  <input
                    type="checkbox"
                    checked={evidence.includes(d.id)}
                    disabled={!evidence.includes(d.id) && evidence.length === 2}
                    onChange={() =>
                      setEvidence((prev) =>
                        prev.includes(d.id)
                          ? prev.filter((id) => id !== d.id)
                          : [...prev, d.id],
                      )
                    }
                  />
                  <span>{d.title}</span>
                  <Icon name="file" size={16} />
                </label>
              ))}
            </div>
          </fieldset>
          {sameAsLast && (
            <p className="notice">
              You already submitted this conclusion. Reconsider the evidence
              before trying again.
            </p>
          )}
          {confirming ? (
            <div className="confirm-verdict">
              <p>
                <strong>Submit this conclusion?</strong> A wrong answer costs
                one attempt, adds 60 seconds, and deducts 150 additional points.
              </p>
              <button
                className="button secondary"
                onClick={() => setConfirming(false)}
              >
                Keep investigating
              </button>
              <button
                className="button"
                disabled={submitLock}
                onClick={() => {
                  setSubmitLock(true);
                  playSound("stamp");
                  dispatch({ type: "accuse", caseData, accusation });
                }}
              >
                Confirm verdict
                <Icon name="stamp" />
              </button>
            </div>
          ) : (
            <div className="panel-actions">
              <span className="muted">
                {3 - run.wrongAttempts} attempts remaining
              </span>
              <button
                className="button"
                disabled={!ready || !!sameAsLast || submitLock}
                onClick={() => setConfirming(true)}
              >
                Submit verdict
                <Icon name="arrow" />
              </button>
            </div>
          )}
        </Dialog>
      )}
      {panel === "verdict-feedback" && (
        <Dialog
          title="Verdict incorrect"
          label="BUREAU REVIEW · CONCLUSION REJECTED"
          tone="verdict-feedback-dialog"
          onClose={close}
        >
          <div className="verdict-feedback" role="alert">
            <div className="rejected-stamp" aria-hidden="true">INCORRECT</div>
            <p>
              The evidence does not support your conclusion.
              Recheck the respondent, the person responsible, the explanation,
              and your two supporting documents.
            </p>
            <strong className="attempts-remaining">
              {3 - run.wrongAttempts} {run.wrongAttempts === 2 ? "attempt" : "attempts"} remaining
            </strong>
            <dl className="verdict-penalties">
              <div><dt>Attempt used</dt><dd>−1 coffee</dd></div>
              <div><dt>Time penalty</dt><dd>+60 seconds</dd></div>
              <div><dt>Additional score penalty</dt><dd>−150 points</dd></div>
            </dl>
          </div>
          <p className="feedback-pause-note">Clock paused while you read this notice.</p>
          <div className="feedback-actions">
            <button className="button" onClick={() => setPanel("verdict")}>
              Review my verdict
            </button>
            <button className="button secondary" onClick={close}>
              Back to investigation
            </button>
          </div>
        </Dialog>
      )}
      {panel === "calendar" && (
        <Dialog title="Office calendar" onClose={close}>
          <div className="calendar-display">
            <span>DATE IN THIS CASE</span>
            <strong>
              {caseData.gameDate || caseData.worldDate || "11/14/2026"}
            </strong>
            <p>
              Dates in the records belong to this fictional timeline. Compare
              the invoice, payment and message dates carefully.
            </p>
            <p className="notice">
              Your current play streak: {getStreak()} day(s).
            </p>
          </div>
        </Dialog>
      )}
      {panel === "help" && (
        <Dialog title="A good detective follows the details." onClose={close}>
          <ol className="how-to-list">
            <li>
              <strong>Read the file.</strong> Your client has a story. The
              documents have another.
            </li>
            <li>
              <strong>Follow a clue.</strong> Open the computer and click a highlighted name, company or
              reference in your record. You can also type it into the search bar.
            </li>
            <li>
              <strong>Build your case.</strong> Pin records that support or
              contradict the story.
            </li>
            <li>
              <strong>Make a verdict.</strong> Stamp the respondent GUILTY or
              NOT GUILTY, then choose who, how and two pieces of proof.
            </li>
          </ol>
          <p className="notice">
            Three coffees, three attempts. Wrong conclusions cost 60 seconds and
            150 additional points. Leaving the desk pauses the timer.
          </p>
        </Dialog>
      )}
    </main>
  );
}

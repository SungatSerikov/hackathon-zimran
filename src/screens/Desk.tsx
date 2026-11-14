import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Accusation, CaseData, CaseDocument, Verdict } from "../types";
import { gameReducer, createRun } from "../store/game";
import { loadRun, saveRun } from "../lib/storage";
import { getStreak } from "../lib/streak";
import { Icon } from "../components/Icons";
import { Dialog } from "../components/Dialog";
import { DocumentView, docLabels } from "../components/DocumentView";
import { Scene, Asset, formatTime, type DeskAction } from "../components/Scene";
import { Result } from "./Result";

type Panel =
  "folder" | "search" | "board" | "verdict" | "calendar" | "help" | null;
export function Desk({
  caseData,
  onExit,
  onNext,
  onPaywall,
}: {
  caseData: CaseData;
  onExit: () => void;
  onNext: () => void;
  onPaywall: () => void;
}) {
  const [run, dispatch] = useReducer(
    gameReducer,
    caseData,
    (c) => loadRun(c) || createRun(c),
  );
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState(
    caseData.documents.find((d) => d.initial)?.id || "",
  );
  const [query, setQuery] = useState("");
  const [searchFeedback, setSearchFeedback] = useState("");
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
  const initialCount = caseData.documents.filter((d) => d.initial).length;
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
    "Open the archive monitor. Type a clue you have read — the company name is a good first search.",
    "Follow reference numbers in the records you find. Open useful documents and pin two that prove what happened.",
    "Ready to decide? Open Verdict. Choose a stamp, a person, an explanation, and two pinned documents.",
  ];
  useEffect(() => {
    setStorageFailed(!saveRun(run));
  }, [run]);
  useEffect(() => {
    if (run.status !== "playing") return;
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
  }, [run.status]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (run.wrongAttempts > prevWrong.current) {
      setToast(
        "The records do not support that conclusion. One coffee lost. +60 seconds.",
      );
      setConfirming(false);
      setSubmitLock(true);
    }
    prevWrong.current = run.wrongAttempts;
  }, [run.wrongAttempts]);
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
    dispatch({ type: "pin", documentId: id });
    setToast(
      run.pinnedIds.includes(id)
        ? "Document removed from your board."
        : "Evidence pinned to your board.",
    );
  }
  function action(id: DeskAction) {
    if (id === "monitor") setPanel("search");
    if (id === "folder") openFolder();
    if (id === "board") setPanel("board");
    if (id === "stamps") setPanel("verdict");
    if (id === "safe") onPaywall();
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
  function search() {
    const clean = query.trim();
    if (!clean) return;
    dispatch({ type: "search", caseData, query: clean });
    setSearchFeedback(clean);
    setQuery("");
  }
  const latest = run.queries.at(-1);
  const ready = !!verdict && !!culprit && !!method && evidence.length === 2;
  const accusation = useMemo(
    () =>
      ({
        verdict: verdict || "APPROVED",
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
    <main className="desk-page page-enter">
      <div className="case-heading">
        <div>
          <button className="text-button" onClick={onExit}>
            <Icon name="back" size={15} />
            Case files · save & leave
          </button>
          <h1>{caseData.title}</h1>
          <span className="eyebrow">
            {tutorial ? "TRAINING FILE 001" : "INVESTIGATION 002"}{" "}
            <span className="muted">/</span> RIVERTON, USA
          </span>
        </div>
        <div className="desk-stats">
          <div>
            <Icon name="clock" />
            <strong>{formatTime(run.elapsedSeconds)}</strong>
            <span>ELAPSED</span>
          </div>
          <div className="coffee-stats">
            <span aria-label={`${3 - run.wrongAttempts} attempts remaining`}>
              {[0, 1, 2].map((i) => (
                <Icon
                  key={i}
                  name="coffee"
                  style={{ opacity: i < 3 - run.wrongAttempts ? 1 : 0.2 }}
                />
              ))}
            </span>
            <span>ATTEMPTS</span>
          </div>
          <button
            className="icon-button"
            aria-label="How to play"
            onClick={() => setPanel("help")}
          >
            <Icon name="help" />
          </button>
        </div>
      </div>
      {tutorial && (
        <aside className="tutorial-guide">
          <span className="guide-step">0{tutorialStep + 1}</span>
          <div>
            <span className="eyebrow">YOUR FIRST DAY · FIELD GUIDE</span>
            <p>{guidance[tutorialStep]}</p>
          </div>
          <div
            className="guide-dots"
            aria-label={`Step ${tutorialStep + 1} of 4`}
          >
            {[0, 1, 2, 3].map((s) => (
              <i key={s} className={s <= tutorialStep ? "active" : ""} />
            ))}
          </div>
        </aside>
      )}
      <Scene
        onAction={action}
        elapsed={run.elapsedSeconds}
        lives={3 - run.wrongAttempts}
        evidence={pinned.length}
        date={caseData.gameDate || caseData.worldDate}
      />
      <div className="desk-toolbar">
        <button onClick={openFolder}>
          <Icon name="folder" />
          Case folder <span>{documents.length}</span>
        </button>
        <button onClick={() => setPanel("search")}>
          <Icon name="search" />
          Archive search
        </button>
        <button onClick={() => setPanel("board")}>
          <Icon name="pin" />
          Evidence board <span>{pinned.length}</span>
        </button>
        <button className="verdict-tool" onClick={() => setPanel("verdict")}>
          <Icon name="stamp" />
          Make a verdict
          <Icon name="arrow" size={16} />
        </button>
      </div>
      <div className="desk-bottom">
        <span>
          <i className="status-dot" />
          {storageFailed
            ? "Progress is temporary — browser storage unavailable"
            : "Progress saved on this device"}
        </span>
        <span>Read carefully. Follow the trail. Trust the evidence.</span>
      </div>
      <div className="mobile-brief">
        <span className="eyebrow">THE COMPLAINT</span>
        <p>{caseData.brief}</p>
        <button className="button" onClick={openFolder}>
          Open case folder
          <Icon name="arrow" />
        </button>
      </div>
      <div className="toast" role="status" aria-live="polite">
        {toast && <span>{toast}</span>}
      </div>
      {panel === "folder" && (
        <Dialog
          title="Case folder"
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
        <Dialog
          title="Municipal records archive"
          label="RCA / SECURE TERMINAL / 01"
          wide
          tone="terminal-dialog"
          onClose={close}
        >
          <div className="terminal-intro">
            <span className="status-dot" />
            ARCHIVE CONNECTED{" "}
            <span>Search only the clues you have discovered.</span>
          </div>
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <span aria-hidden="true">&gt;_</span>
            <input
              aria-label="Search archive"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Company, name, reference number…"
              maxLength={120}
            />
            <button className="button" type="submit" disabled={!query.trim()}>
              Search
              <Icon name="search" size={18} />
            </button>
          </form>
          <p className="terminal-help">
            Enter a specific name or number from your documents. Spaces and
            punctuation are okay.
          </p>
          {searchFeedback && latest && (
            <div className="search-results" aria-live="polite">
              <span className="eyebrow">RESULTS FOR “{latest.query}”</span>
              {latest.documentIds.length ? (
                <>
                  <p>
                    {latest.newCount
                      ? `${latest.newCount} new record${latest.newCount === 1 ? "" : "s"} added to your folder.`
                      : "These records are already in your folder."}
                  </p>
                  {latest.documentIds.map((id) => {
                    const d = caseData.documents.find((d) => d.id === id);
                    return d ? (
                      <button
                        className="search-record"
                        key={id}
                        onClick={() => openDoc(d)}
                      >
                        <Icon name="file" />
                        <span>
                          {d.title}
                          <small>{docLabels[d.type]}</small>
                        </span>
                        <Icon name="arrow" />
                      </button>
                    ) : null;
                  })}
                </>
              ) : (
                <div className="empty-search">
                  <Icon name="search" size={34} />
                  <h3>No records found.</h3>
                  <p>
                    Try a name or reference written in a document you have
                    already found. Each new record can lead to the next.
                  </p>
                  <button className="text-button" onClick={openFolder}>
                    Review your case folder →
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="query-history">
            <span className="eyebrow">
              RECENT QUERIES · {run.queries.length}
            </span>
            <div>
              {run.queries
                .slice(-8)
                .reverse()
                .map((q, i) => (
                  <button
                    key={`${i}-${q.query}`}
                    onClick={() => setQuery(q.query)}
                  >
                    {q.query}
                    <small>{q.documentIds.length}</small>
                  </button>
                ))}
              {!run.queries.length && (
                <p>Your search history will appear here.</p>
              )}
            </div>
          </div>
        </Dialog>
      )}
      {panel === "board" && (
        <Dialog
          title="Your evidence board"
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
          label="FINAL REVIEW · SUPPORT YOUR CONCLUSION"
          wide
          onClose={close}
        >
          <div className="claim-paper">
            <span className="eyebrow">CLIENT’S REQUEST</span>
            <blockquote>“{caseData.claim}”</blockquote>
            <div className="verdict-stamps">
              {(["APPROVED", "DENIED"] as const).map((v) => (
                <button
                  className={`stamp-choice ${v.toLowerCase()} ${verdict === v ? "chosen" : ""}`}
                  key={v}
                  onClick={() => setVerdict(v)}
                  aria-pressed={verdict === v}
                >
                  {v}
                  <small>
                    {v === "APPROVED"
                      ? "The complaint is valid"
                      : "The complaint is not valid"}
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
                one attempt and adds 60 seconds.
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
              <strong>Follow a clue.</strong> Search a name, company or
              reference from a record you have found.
            </li>
            <li>
              <strong>Build your case.</strong> Pin records that support or
              contradict the story.
            </li>
            <li>
              <strong>Make a verdict.</strong> Approve or deny the complaint,
              then choose who, how and two pieces of proof.
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

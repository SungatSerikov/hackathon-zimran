import { useEffect, useMemo, useState } from "react";
import type { CaseData } from "../types";
import type { GameRun } from "../store/game";
import { calculateScore } from "../engine/score";
import { validateCase } from "../engine/validate";
import { getScores, submitScore, type ScoreRecord } from "../lib/records";
import { safeRead, safeWrite } from "../lib/storage";
import { Icon } from "../components/Icons";
import { formatTime } from "../components/Scene";

export function Result({
  caseData,
  run,
  onExit,
  onNext,
}: {
  caseData: CaseData;
  run: GameRun;
  onExit: () => void;
  onNext: () => void;
}) {
  const report = useMemo(() => validateCase(caseData), [caseData]);
  const solved = run.status === "solved";
  const score = solved
    ? calculateScore({
        elapsedSeconds: run.elapsedSeconds,
        wrongAttempts: run.wrongAttempts,
        searches: run.queries.length,
        minimumSearches: report.minimumSearches,
      })
    : 0;
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [source, setSource] = useState<"online" | "local">("local");
  const [nickname, setNickname] = useState(() => {
    const saved = safeRead<unknown>("case-desk:nickname", "");
    return typeof saved === "string" ? saved.slice(0, 20) : "";
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedSource, setSavedSource] = useState<"online" | "local" | null>(
    null,
  );
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    getScores(caseData.id)
      .then((r) => {
        if (active) {
          setScores(r.scores);
          setSource(r.source);
        }
      })
      .catch(() =>
        setMessage("Ranking unavailable. Your case result is still saved."),
      );
    return () => {
      active = false;
    };
  }, [caseData.id]);
  useEffect(() => {
    if (solved) {
      const key = `case-desk:best:${caseData.id}`;
      const previous = safeRead<unknown>(key, 0);
      safeWrite(
        key,
        Math.max(
          typeof previous === "number" && Number.isFinite(previous)
            ? previous
            : 0,
          score,
        ),
      );
    }
  }, [caseData.id, score, solved]);
  async function save() {
    if (saving || saved) return;
    setSaving(true);
    setMessage("");
    try {
      const r = await submitScore({
        case_id: caseData.id,
        nickname: nickname.trim(),
        score,
        time_ms: run.elapsedSeconds * 1000,
        wrong: run.wrongAttempts,
        searches: run.queries.length,
      });
      setSource(r.source);
      setSavedSource(r.source);
      safeWrite("case-desk:nickname", nickname.trim());
      setSaved(true);
      const next = await getScores(caseData.id);
      setScores(next.scores);
      setSource(next.source);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not save the score. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  const culprit = caseData.characters.find(
    (c) => c.id === caseData.solution.culprit,
  );
  const method = caseData.solution.methods.find(
    (m) => m.id === caseData.solution.correctMethod,
  );
  return (
    <main className="result-page page-enter">
      <button className="text-button" onClick={onExit}>
        <Icon name="back" size={16} />
        All case files
      </button>
      <div className="result-heading">
        <span className="eyebrow">{caseData.title} / CASE CLOSED</span>
        <div className={`result-stamp ${solved ? "solved" : "failed"}`}>
          {solved ? "CASE SOLVED" : "CASE REVIEWED"}
        </div>
        <h1>
          {solved
            ? "The details added up."
            : "Every case teaches you something."}
        </h1>
        <p>
          {solved
            ? "Your conclusion is supported by the evidence."
            : "Your three attempts are used. Here is what the records reveal."}
        </p>
      </div>
      <div className="result-grid">
        <section className="result-report">
          <div className="score-display">
            <div>
              <span className="eyebrow">CASE SCORE</span>
              <strong>
                {score}
                <small>/ 1,000</small>
              </strong>
            </div>
            <Icon name="trophy" size={48} />
          </div>
          <div className="score-details">
            <div>
              <span>Time, including penalties</span>
              <strong>{formatTime(run.elapsedSeconds)}</strong>
            </div>
            <div>
              <span>Wrong conclusions</span>
              <strong>
                {run.wrongAttempts}{" "}
                <small>(−{150 * run.wrongAttempts} pts)</small>
              </strong>
            </div>
            <div>
              <span>Archive searches</span>
              <strong>
                {run.queries.length}{" "}
                <small>({report.minimumSearches} minimum)</small>
              </strong>
            </div>
            <div>
              <span>Extra-search deduction</span>
              <strong>
                −{Math.max(0, run.queries.length - report.minimumSearches) * 5}{" "}
                pts
              </strong>
            </div>
          </div>
          <div className="case-resolution">
            <span
              className={`badge ${caseData.solution.verdict === "APPROVED" ? "green" : "red"}`}
            >
              {caseData.solution.verdict}
            </span>
            <h2>{culprit?.name}</h2>
            <p className="resolution-method">{method?.text}</p>
            <p>{caseData.solution.explanation}</p>
            <h3>The evidence that mattered</h3>
            {caseData.solution.requiredEvidence.map((id, i) => {
              const d = caseData.documents.find((x) => x.id === id);
              return d ? (
                <div className="resolution-clue" key={id}>
                  <span>0{i + 1}</span>
                  <div>
                    <strong>{d.title}</strong>
                    <p>{d.text}</p>
                  </div>
                </div>
              ) : null;
            })}
            <details className="solution-route">
              <summary>Show the shortest archive trail</summary>
              <ol>
                {report.solutionPath.map((q, i) => (
                  <li key={i}>
                    Search <strong>{q}</strong>
                  </li>
                ))}
              </ol>
            </details>
            <p className="practical-takeaway">
              <Icon name="star" size={19} />A real-world habit: compare original
              records, recipients and timestamps before accepting a claim.
            </p>
          </div>
        </section>
        <aside className="rank-panel">
          <span className="eyebrow">THE DETECTIVE REGISTER</span>
          <h2>Case leaderboard</h2>
          <span className="source-label">
            <i className="status-dot" />
            {source === "online"
              ? "Community · unverified scores"
              : "Local · this browser only"}
          </span>
          {solved && !saved ? (
            <form
              className="score-form"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label htmlFor="nickname">Sign your case report</label>
              <input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Your detective name"
                minLength={2}
                maxLength={20}
                required
              />
              <button
                className="button"
                disabled={saving || nickname.trim().length < 2}
              >
                {saving ? "Saving…" : "Add my score"}
                <Icon name="arrow" size={16} />
              </button>
            </form>
          ) : saved ? (
            <p className="notice success">
              <Icon name="check" size={16} />
              {savedSource === "online"
                ? "Your score was added to the community register."
                : "Your score is saved on this device. Community upload is unavailable."}
            </p>
          ) : null}
          {message && (
            <p role="alert" className="notice">
              {message}
            </p>
          )}
          {scores.length ? (
            <ol className="leaderboard">
              {scores.slice(0, 10).map((s, i) => (
                <li key={s.id}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <strong>{s.nickname}</strong>
                  <b>{s.score}</b>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-ranking">
              <Icon name="trophy" size={30} />
              <p>
                No scores on this device yet.
                <br />
                Start the register.
              </p>
            </div>
          )}
          <div className="rank-footnote">
            Practice makes a sharper detective. Replays are welcome; this demo
            ranking is not cheat-proof.
          </div>
          <button className="button next-case" onClick={onNext}>
            {caseData.difficulty === 1
              ? "Open the next case"
              : "Back to case files"}
            <Icon name="arrow" />
          </button>
        </aside>
      </div>
    </main>
  );
}

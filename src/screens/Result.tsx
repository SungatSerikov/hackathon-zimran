import { useEffect, useMemo, useState } from "react";
import type { CaseData } from "../types";
import type { GameRun } from "../store/game";
import { calculateScore } from "../engine/score";
import { validateCase } from "../engine/validate";
import { getScores, submitScore, type ScoreRecord } from "../lib/records";
import { safeRead, safeWrite } from "../lib/storage";
import { Icon } from "../components/Icons";
import { formatTime } from "../components/Scene";
import { awardCaseFee } from "../engine/wallet";
import { bureauMoney } from "../components/EconomyPanel";
import { useI18n } from "../i18n/I18n";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

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
  const { t, locale } = useI18n();
  const report = useMemo(() => validateCase(caseData), [caseData]);
  const solved = run.status === "solved";
  const score = solved
    ? calculateScore({
        elapsedSeconds: run.elapsedSeconds,
        wrongAttempts: run.wrongAttempts,
        searches: run.queries.length,
        minimumSearches: report.minimumSearches,
        hints: run.hints.length,
      })
    : 0;
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [fee, setFee] = useState(0);
  useEffect(() => {
    setFee(awardCaseFee(caseData, run).fee);
  }, [caseData, run]);
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
  const [message, setMessage] = useState<"ranking" | "nickname" | "save" | null>(null);
  useEffect(() => {
    let active = true;
    getScores(caseData.id)
      .then((r) => {
        if (active) {
          setScores(r.scores);
          setSource(r.source);
        }
      })
      .catch(() => {
        if (active) setMessage("ranking");
      });
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
    setMessage(null);
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
        e instanceof Error && e.message === "Use a 2–20 character nickname and valid game results."
          ? "nickname"
          : "save",
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
      <div className="result-utilities">
      <button className="text-button" onClick={onExit}>
        <Icon name="back" size={16} />
        {t("All case files", "Все дела")}
      </button>
      <LanguageSwitcher />
      </div>
      <div className="result-heading">
        <span className="eyebrow">{caseData.title} / {t("CASE CLOSED", "ДЕЛО ЗАКРЫТО")}</span>
        <div className={`result-stamp ${solved ? "solved" : "failed"}`}>
          {solved ? t("CASE SOLVED", "ДЕЛО РАСКРЫТО") : t("CASE FAILED", "ДЕЛО ПРОВАЛЕНО")}
        </div>
        <h1>
          {solved
            ? t("The details added up.", "Все детали сошлись.")
            : t("No attempts remaining.", "Попыток больше нет.")}
        </h1>
        <p>
          {solved
            ? t("Your conclusion is supported by the evidence.", "Улики подтверждают ваш вывод.")
            : t("Your final verdict was incorrect. All three attempts are used. Here is what the records reveal.", "Ваш последний вердикт оказался неверным. Все три попытки использованы. Вот что раскрывают документы.")}
        </p>
      </div>
      <div className="result-grid">
        <section className="result-report">
          <div className="score-display">
            <div>
              <span className="eyebrow">{t("CASE SCORE", "ОЧКИ ЗА ДЕЛО")}</span>
              <strong>
                {score.toLocaleString(locale)}
                <small>/ {(1000).toLocaleString(locale)}</small>
              </strong>
            </div>
            <Icon name="trophy" size={48} />
          </div>
          <div className="score-details">
            <div>
              <span>{t("Time, including penalties", "Время со штрафами")}</span>
              <strong>{formatTime(run.elapsedSeconds)}</strong>
            </div>
            <div>
              <span>{t("Wrong conclusions", "Неверные выводы")}</span>
              <strong>
                {run.wrongAttempts}{" "}
                <small>(−{150 * run.wrongAttempts} {t("pts", "очк.")})</small>
              </strong>
            </div>
            <div>
              <span>{t("Archive searches", "Запросы в архиве")}</span>
              <strong>
                {run.queries.length}{" "}
                <small>{t(`(${report.minimumSearches} minimum)`, `(минимум: ${report.minimumSearches})`)}</small>
              </strong>
            </div>
            <div>
              <span>{t("Informant calls", "Звонки информатору")}</span>
              <strong>
                {run.hints.length} <small>(−{run.hints.length * 50} {t("pts", "очк.")})</small>
              </strong>
            </div>
            <div>
              <span>{t("Extra-search deduction", "Штраф за лишние запросы")}</span>
              <strong>
                −{Math.max(0, run.queries.length - report.minimumSearches) * 5}{" "}
                {t("pts", "очк.")}
              </strong>
            </div>
          </div>
          <div className="fee-receipt">
            <Icon name="lock" size={27} />
            <div>
              <span className="eyebrow">{t("CASE FEE · ADDED TO YOUR SAFE", "ГОНОРАР ЗА ДЕЛО · ДОБАВЛЕН В СЕЙФ")}</span>
              <strong>+{bureauMoney(fee)}</strong>
              <small>
                {solved
                  ? t("Already paid fees are never credited twice. Repeat clears earn 25%.", "Выплаченный гонорар не начисляется дважды. Повторное раскрытие дела приносит 25%.")
                  : t("Close the case successfully to earn a fee.", "Успешно раскройте дело, чтобы получить гонорар.")}
              </small>
            </div>
            <span className="flying-bill">$</span>
          </div>
          <div className="case-resolution">
            <span
              className={`badge ${caseData.solution.verdict === "GUILTY" ? "red" : "green"}`}
            >
              {caseData.solution.verdict === "GUILTY" ? t("GUILTY", "ВИНОВЕН") : t("NOT GUILTY", "НЕ ВИНОВЕН")}
            </span>
            <h2>{caseData.claim.respondent}</h2>
            <p><strong>{t("Real culprit:", "Настоящий виновник:")}</strong> {culprit?.name}</p>
            <p className="resolution-method">{method?.text}</p>
            <p>{caseData.solution.explanation}</p>
            <h3>{t("The evidence that mattered", "Ключевые доказательства")}</h3>
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
              <summary>{t("Show the shortest archive trail", "Показать кратчайший путь поиска в архиве")}</summary>
              <ol>
                {report.solutionPath.map((q, i) => (
                  <li key={i}>
                    {t("Search", "Поиск")} <strong>{q}</strong>
                  </li>
                ))}
              </ol>
            </details>
            <p className="practical-takeaway">
              <Icon name="star" size={19} />{t("A real-world habit: compare original records, recipients and timestamps before accepting a claim.", "Полезная привычка в жизни: проверяйте оригиналы документов, получателей и время событий, прежде чем верить чьим-либо словам.")}
            </p>
          </div>
        </section>
        <aside className="rank-panel">
          <span className="eyebrow">{t("THE DETECTIVE REGISTER", "РЕЕСТР ДЕТЕКТИВОВ")}</span>
          <h2>{t("Case leaderboard", "Рейтинг по делу")}</h2>
          <span className="source-label">
            <i className="status-dot" />
            {source === "online"
              ? t("Community · unverified scores", "Общий · результаты не проверены")
              : t("Local · this browser only", "Локальный · только этот браузер")}
          </span>
          {solved && !saved ? (
            <form
              className="score-form"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label htmlFor="nickname">{t("Sign your case report", "Подпишите отчёт по делу")}</label>
              <input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t("Your detective name", "Ваше имя детектива")}
                minLength={2}
                maxLength={20}
                required
              />
              <button
                className="button"
                disabled={saving || nickname.trim().length < 2}
              >
                {saving ? t("Saving…", "Сохранение…") : t("Add my score", "Добавить результат")}
                <Icon name="arrow" size={16} />
              </button>
            </form>
          ) : saved ? (
            <p className="notice success">
              <Icon name="check" size={16} />
              {savedSource === "online"
                ? t("Your score was added to the community register.", "Ваш результат добавлен в общий реестр.")
                : t("Your score is saved on this device. Community upload is unavailable.", "Результат сохранён на этом устройстве. Загрузка в общий реестр недоступна.")}
            </p>
          ) : null}
          {message && (
            <p role="alert" className="notice">
              {message === "ranking"
                ? t("Ranking unavailable. Your case result is still saved.", "Рейтинг недоступен. Результат вашего дела сохранён.")
                : message === "nickname"
                  ? t("Use a 2–20 character nickname and valid game results.", "Введите имя длиной от 2 до 20 символов и корректные результаты игры.")
                  : t("Could not save the score. Try again.", "Не удалось сохранить результат. Попробуйте ещё раз.")}
            </p>
          )}
          {scores.length ? (
            <ol className="leaderboard">
              {scores.slice(0, 10).map((s, i) => (
                <li key={s.id}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <strong>{s.nickname}</strong>
                  <b>{s.score.toLocaleString(locale)}</b>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-ranking">
              <Icon name="trophy" size={30} />
              <p>
                {t("No scores on this device yet.", "На этом устройстве пока нет результатов.")}
                <br />
                {t("Start the register.", "Станьте первым в реестре.")}
              </p>
            </div>
          )}
          <div className="rank-footnote">
            {t("Practice makes a sharper detective. Replays are welcome; this demo ranking is not cheat-proof.", "Практика делает детектива внимательнее. Играйте снова: рейтинг в демоверсии не защищён от накрутки.")}
          </div>
          <button className="button next-case" onClick={onNext}>
            {caseData.difficulty === 1
              ? t("Open the next case", "Открыть следующее дело")
              : t("Back to case files", "Вернуться к делам")}
            <Icon name="arrow" />
          </button>
        </aside>
      </div>
    </main>
  );
}

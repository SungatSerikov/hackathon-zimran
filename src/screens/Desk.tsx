import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Accusation, CaseData, CaseDocument, Verdict } from "../types";
import { gameReducer, createRun } from "../store/game";
import { loadRun, saveRun, safeRead, safeWrite } from "../lib/storage";
import { getStreak } from "../lib/streak";
import { Icon } from "../components/Icons";
import { Dialog } from "../components/Dialog";
import { DocumentView, useDocumentLabels } from "../components/DocumentView";
import { RecordsComputer } from "../components/RecordsComputer";
import { Scene, Asset, formatTime, type DeskAction } from "../components/Scene";
import { Result } from "./Result";
import { EconomyPanel, bureauMoney } from "../components/EconomyPanel";
import { getWallet } from "../engine/wallet";
import type { GameSound } from "../lib/gameAudio";
import { FullscreenButton } from "../components/FullscreenButton";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useI18n } from "../i18n/I18n";
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
  const { t } = useI18n();
  const docLabels = useDocumentLabels();
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
    t("Start with the case folder. Read the complaint and look for a company name or reference number.", "Начните с папки дела. Прочитайте жалобу и найдите название компании или номер документа."),
    t("Open the computer. Read a record and click a highlighted name or number to search it.", "Откройте компьютер. Прочитайте запись и нажмите на выделенное имя или номер, чтобы найти сведения о нём."),
    t("Open a search result inside the computer. Follow its highlighted details and pin two records that prove what happened.", "Откройте результат поиска на компьютере. Изучите выделенные детали и закрепите два документа, которые доказывают, что произошло."),
    t("Ready to decide? Open Verdict. Choose a stamp, a person, an explanation, and two pinned documents.", "Готовы принять решение? Откройте «Вердикт». Выберите печать, человека, объяснение и два закреплённых документа."),
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
        ? t("Document removed from your board.", "Документ убран с доски улик.")
        : t("Evidence pinned to your board.", "Документ закреплён на доске улик."),
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
        t(`${3 - run.wrongAttempts} attempts left. Each incorrect verdict costs a coffee and adds 60 seconds.`, `Осталось попыток: ${3 - run.wrongAttempts}. Каждый неверный вердикт стоит чашки кофе и добавляет 60 секунд.`),
      );
    if (id === "clock")
      setToast(
        t("Take your time. Accuracy matters. The clock pauses when you return to the case list.", "Не спешите. Точность важнее. Таймер останавливается, когда вы возвращаетесь к списку дел."),
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
      const key = e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
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
          aria-label={t("Pause game", "Приостановить игру")}
        >
          <span aria-hidden="true">Ⅱ</span>
          <kbd>ESC</kbd>
        </button>
        <div className="hud-case">
          <span>{tutorial ? t("TRAINING / 001", "ОБУЧЕНИЕ / 001") : t("CASE / 002", "ДЕЛО / 002")}</span>
          <h1>{caseData.title}</h1>
        </div>
        <div
          className="hud-clock"
          aria-label={t(`Elapsed time ${formatTime(run.elapsedSeconds)}`, `Прошло времени: ${formatTime(run.elapsedSeconds)}`)}
        >
          <Icon name="clock" size={16} />
          <strong>{formatTime(run.elapsedSeconds)}</strong>
        </div>
        <div
          className="hud-lives"
          aria-label={t(`${3 - run.wrongAttempts} attempts remaining`, `Осталось попыток: ${3 - run.wrongAttempts}`)}
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
          aria-label={t(`Bureau cash ${bureauMoney(balance)}`, `Деньги бюро: ${bureauMoney(balance)}`)}
        >
          <Icon name="lock" size={14} />
          {bureauMoney(balance)}
        </button>
        <button
          className="hud-sound"
          onClick={onSound}
          aria-label={soundEnabled ? t("Mute sound", "Выключить звук") : t("Enable sound", "Включить звук")}
          aria-pressed={soundEnabled}
        >
          <Icon name="sound" size={18} />
          {!soundEnabled && <i />}
        </button>
        <FullscreenButton />
        <LanguageSwitcher />
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
          activeObject={
            panel === "search" ? "monitor" : panel === "hint" ? "phone"
              : panel === "wallet" ? "safe" : panel === "folder" ? "folder" : undefined
          }
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
              <span>{t("FIELD NOTE", "ЗАМЕТКА")} {tutorialStep + 1}/4</span>
              <button onClick={() => toggleGuide(false)} aria-label={t("Hide tutorial hint", "Скрыть подсказку обучения")}><Icon name="close" size={14} /></button>
            </div>
            <p>{guidance[tutorialStep]}</p>
          </div>
        ) : !tutorial ? (
          <span className="room-caption">
            {t("Your desk. Your investigation.", "Ваш стол. Ваше расследование.")}
            <small>{t("Click an object to examine it.", "Нажмите на предмет, чтобы изучить его.")}</small>
          </span>
        ) : null}
        <div className="desk-assistance">
          {tutorial && <button className="guide-toggle" aria-expanded={guideExpanded}
            aria-controls={guideExpanded ? "tutorial-guidance" : undefined} onClick={() => toggleGuide(!guideExpanded)}>
            <Icon name="help" size={14} /> {t("Tutorial hint", "Подсказка обучения")}
          </button>}
        <button
          className="hotspot-toggle"
          aria-pressed={hotspots}
          onClick={() => setHotspots((v) => !v)}
        >
          <Icon name="search" size={14} />
          {hotspots ? t("Hide labels", "Скрыть подписи") : t("Show objects", "Показать предметы")}
        </button>
        </div>
      </div>
      <nav className="game-toolbelt" aria-label={t("Investigation tools", "Инструменты расследования")}>
        <button onClick={openFolder} data-sound="paper">
          <kbd>F</kbd>
          <Icon name="folder" />
          <span>{t("Folder", "Папка")}</span>
          <b>{documents.length}</b>
        </button>
        <button onClick={() => action("monitor")}>
          <kbd>A</kbd>
          <Icon name="search" />
          <span>{t("Archive", "Архив")}</span>
        </button>
        <button onClick={() => action("board")}>
          <kbd>E</kbd>
          <Icon name="pin" />
          <span>{t("Evidence", "Улики")}</span>
          <b>{pinned.length}</b>
        </button>
        <button onClick={() => action("phone")}>
          <kbd>H</kbd>
          <Icon name="phone" />
          <span>{t("Informant", "Информатор")}</span>
        </button>
        <button className="tool-verdict" onClick={() => action("stamps")}>
          <kbd>V</kbd>
          <Icon name="stamp" />
          <span>{t("Verdict", "Вердикт")}</span>
        </button>
      </nav>
      <div
        className={`save-indicator ${storageFailed ? "save-failed" : ""}`}
        role={storageFailed ? "status" : undefined}
      >
        {storageFailed
          ? t("Progress is temporary: browser storage unavailable", "Прогресс временный: хранилище браузера недоступно")
          : t("AUTO-SAVED", "АВТОСОХРАНЕНИЕ")}
        <span className="status-dot" />
      </div>
      {panel === "briefing" && (
        <Dialog
          title={client.name}
          label={t("A CLIENT AT YOUR DESK", "КЛИЕНТ В ВАШЕМ БЮРО")}
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
              <span>{t("COMPLAINANT", "ЗАЯВИТЕЛЬ")} / {caseData.gameDate}</span>
            </div>
            <div className="client-dialogue">
              <span className="eyebrow">{caseData.title}</span>
              <blockquote>
                “{caseData.claim.statement}”
              </blockquote>
              <p>{caseData.brief}</p>
              <button className="button" data-sound="paper" onClick={close}>
                {t("I’ll look into it.", "Я разберусь.")}
                <Icon name="folder" size={18} />
              </button>
              <small>{t("The case file is on your desk. Open it to begin.", "Папка дела лежит на столе. Откройте её, чтобы начать.")}</small>
            </div>
          </div>
        </Dialog>
      )}
      {panel === "pause" && (
        <Dialog
          title={t("Take a breath, detective.", "Передохните, детектив.")}
          label={t("SHIFT PAUSED · YOUR CLOCK IS STOPPED", "ПЕРЕРЫВ · ТАЙМЕР ОСТАНОВЛЕН")}
          onClose={close}
          tone="pause-dialog"
        >
          <div className="pause-options">
            <button className="button" onClick={close}>
              {t("Resume investigation", "Продолжить расследование")}
              <Icon name="arrow" />
            </button>
            <button onClick={() => setPanel("briefing")}>
              <Icon name="people" size={18} /> {t("Read the client’s statement", "Прочитать заявление клиента")}
            </button>
            <button onClick={() => setPanel("help")}>
              <Icon name="help" size={18} /> {t("How to play", "Как играть")}
            </button>
            <button onClick={onSound}>
              <Icon name="sound" size={18} />
              {soundEnabled ? t("Sound: on", "Звук: включён") : t("Sound: off", "Звук: выключен")}
            </button>
            <button onClick={onExit}>
              <Icon name="back" size={18} /> {t("Save & return to case files", "Сохранить и вернуться к делам")}
            </button>
          </div>
          <p className="fine-print">
            {t("Your evidence and progress stay on this device.", "Ваши улики и прогресс сохраняются на этом устройстве.")}
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
          title={t("Case folder", "Папка дела")}
          tone="folder-dialog"
          label={t(`${documents.length} RECORDS ON FILE`, `ДОКУМЕНТОВ В ДЕЛЕ: ${documents.length}`)}
          wide
          onClose={close}
        >
          <div className="folder-layout">
            <aside className="folder-sidebar">
              <p className="case-brief">{caseData.brief}</p>
              <span className="eyebrow">{t("DOCUMENTS", "ДОКУМЕНТЫ")}</span>
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
                      <i className="new-dot" title={t("Unread", "Не прочитано")} />
                    ) : null}
                  </button>
                ))}
              </div>
              <button
                className="text-button"
                onClick={() => setPanel("search")}
              >
                <Icon name="search" size={15} />
                {t("Find more in the archive", "Найти больше в архиве")}
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
          title={t("Your evidence board", "Ваша доска улик")}
          tone="board-dialog"
          label={t(`${pinned.length} PINNED RECORDS`, `ЗАКРЕПЛЕНО ДОКУМЕНТОВ: ${pinned.length}`)}
          wide
          onClose={close}
        >
          <p className="panel-intro">
            {t("Connect the details. You will need two documents to support your final verdict.", "Сопоставьте детали. Для окончательного вердикта вам понадобятся два подтверждающих документа.")}
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
                    {t("EXHIBIT", "УЛИКА")} {String.fromCharCode(65 + i)}
                  </span>
                  <h3>{d.title}</h3>
                  <p>{d.text.slice(0, 140)}…</p>
                  <span className="text-button">
                    {t("Examine record", "Изучить документ")} <Icon name="arrow" size={15} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Icon name="pin" size={40} />
              <h3>{t("Every case starts with a loose thread.", "Каждое дело начинается с зацепки.")}</h3>
              <p>
                {t("Open a document and choose “Pin as evidence” to keep it here.", "Откройте документ и выберите «Закрепить как улику», чтобы добавить его сюда.")}
              </p>
              <button className="button" onClick={openFolder}>
                {t("Open case folder", "Открыть папку дела")}
              </button>
            </div>
          )}
          <div className="panel-actions">
            <button
              className="button secondary"
              onClick={() => setPanel("search")}
            >
              {t("Search the archive", "Искать в архиве")}
            </button>
            <button className="button" onClick={() => setPanel("verdict")}>
              {t("Make a verdict", "Вынести вердикт")}
              <Icon name="stamp" />
            </button>
          </div>
        </Dialog>
      )}
      {panel === "verdict" && (
        <Dialog
          title={t("Make your verdict", "Вынесите вердикт")}
          tone="verdict-dialog"
          label={t("FINAL REVIEW · SUPPORT YOUR CONCLUSION", "ИТОГОВАЯ ПРОВЕРКА · ПОДТВЕРДИТЕ ВЫВОД")}
          wide
          onClose={close}
        >
          {run.wrongAttempts > 0 && (
            <div className="verdict-error-banner" role="status">
              <strong>{t("Your previous verdict was incorrect.", "Ваш предыдущий вердикт был неверным.")}</strong>
              <span>
                {t(`${3 - run.wrongAttempts} ${run.wrongAttempts === 2 ? "attempt" : "attempts"} remaining. Recheck your conclusion before submitting again.`, `Осталось попыток: ${3 - run.wrongAttempts}. Проверьте свой вывод перед повторной отправкой.`)}
              </span>
            </div>
          )}
          <div className="claim-paper">
            <span className="eyebrow">{t("RIVERTON CONSUMER AFFAIRS · CLAIM", "БЮРО ЗАЩИТЫ ПОТРЕБИТЕЛЕЙ РИВЕРТОНА · ЖАЛОБА")} #{caseData.claim.number}</span>
            <dl className="claim-details">
              <div><dt>{t("Claimant", "Заявитель")}</dt><dd>{client.name}</dd></div>
              <div><dt>{t("Respondent", "Ответчик")}</dt><dd>{caseData.claim.respondent}</dd></div>
              <div><dt>{t("Request", "Требование")}</dt><dd>{caseData.claim.request}</dd></div>
              {caseData.claim.amount !== undefined && (
                <div><dt>{t("Amount", "Сумма")}</dt><dd>{bureauMoney(caseData.claim.amount)}</dd></div>
              )}
            </dl>
            <blockquote>“{caseData.claim.statement}”</blockquote>
            <p className="stamp-instruction">
              {t("Stamp the respondent: GUILTY if they owe the claimant, NOT GUILTY if they don’t.", "Поставьте печать для ответчика: «ВИНОВЕН», если он должен заявителю, или «НЕ ВИНОВЕН», если нет.")}
            </p>
            <div className="verdict-stamps">
              {(["GUILTY", "NOT_GUILTY"] as const).map((v) => (
                <button
                  className={`stamp-choice ${v.toLowerCase()} ${verdict === v ? "chosen" : ""}`}
                  key={v}
                  onClick={() => setVerdict(v)}
                  aria-pressed={verdict === v}
                >
                  {v === "GUILTY" ? t("GUILTY", "ВИНОВЕН") : t("NOT GUILTY", "НЕ ВИНОВЕН")}
                  <small>
                    {v === "GUILTY"
                      ? t("Respondent owes the claimant", "Ответчик должен заявителю")
                      : t("Respondent is not responsible", "Ответчик не несёт ответственности")}
                  </small>
                </button>
              ))}
            </div>
          </div>
          <fieldset className="verdict-section">
            <legend>
              <span>01</span> {t("Who is responsible?", "Кто несёт ответственность?")}
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
              <span>02</span> {t("What actually happened?", "Что произошло на самом деле?")}
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
              <span>03</span> {t("Select exactly two supporting documents", "Выберите ровно два подтверждающих документа")}{" "}
              <small>{evidence.length}/2</small>
            </legend>
            {pinned.length < 2 && (
              <p className="notice">
                {t("Pin at least two documents from your folder first.", "Сначала закрепите хотя бы два документа из папки дела.")}{" "}
                <button className="text-button" onClick={openFolder}>
                  {t("Open folder →", "Открыть папку →")}
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
              {t("You already submitted this conclusion. Reconsider the evidence before trying again.", "Вы уже отправляли такой вывод. Пересмотрите улики перед новой попыткой.")}
            </p>
          )}
          {confirming ? (
            <div className="confirm-verdict">
              <p>
                <strong>{t("Submit this conclusion?", "Отправить этот вывод?")}</strong>{" "}
                {t("A wrong answer costs one attempt, adds 60 seconds, and deducts 150 additional points.", "Неверный ответ отнимает одну попытку, добавляет 60 секунд и дополнительно снимает 150 очков.")}
              </p>
              <button
                className="button secondary"
                onClick={() => setConfirming(false)}
              >
                {t("Keep investigating", "Продолжить расследование")}
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
                {t("Confirm verdict", "Подтвердить вердикт")}
                <Icon name="stamp" />
              </button>
            </div>
          ) : (
            <div className="panel-actions">
              <span className="muted">
                {t(`${3 - run.wrongAttempts} attempts remaining`, `Осталось попыток: ${3 - run.wrongAttempts}`)}
              </span>
              <button
                className="button"
                disabled={!ready || !!sameAsLast || submitLock}
                onClick={() => setConfirming(true)}
              >
                {t("Submit verdict", "Отправить вердикт")}
                <Icon name="arrow" />
              </button>
            </div>
          )}
        </Dialog>
      )}
      {panel === "verdict-feedback" && (
        <Dialog
          title={t("Verdict incorrect", "Неверный вердикт")}
          label={t("BUREAU REVIEW · CONCLUSION REJECTED", "ПРОВЕРКА БЮРО · ВЫВОД ОТКЛОНЁН")}
          tone="verdict-feedback-dialog"
          onClose={close}
        >
          <div className="verdict-feedback" role="alert">
            <div className="rejected-stamp" aria-hidden="true">{t("INCORRECT", "НЕВЕРНО")}</div>
            <p>
              {t("The evidence does not support your conclusion. Recheck the respondent, the person responsible, the explanation, and your two supporting documents.", "Улики не подтверждают ваш вывод. Ещё раз проверьте вердикт для ответчика, ответственного человека, объяснение и два подтверждающих документа.")}
            </p>
            <strong className="attempts-remaining">
              {t(`${3 - run.wrongAttempts} ${run.wrongAttempts === 2 ? "attempt" : "attempts"} remaining`, `Осталось попыток: ${3 - run.wrongAttempts}`)}
            </strong>
            <dl className="verdict-penalties">
              <div><dt>{t("Attempt used", "Потрачена попытка")}</dt><dd>{t("−1 coffee", "−1 чашка кофе")}</dd></div>
              <div><dt>{t("Time penalty", "Штраф по времени")}</dt><dd>{t("+60 seconds", "+60 секунд")}</dd></div>
              <div><dt>{t("Additional score penalty", "Дополнительный штраф")}</dt><dd>{t("−150 points", "−150 очков")}</dd></div>
            </dl>
          </div>
          <p className="feedback-pause-note">{t("Clock paused while you read this notice.", "Пока вы читаете это уведомление, таймер остановлен.")}</p>
          <div className="feedback-actions">
            <button className="button" onClick={() => setPanel("verdict")}>
              {t("Review my verdict", "Пересмотреть вердикт")}
            </button>
            <button className="button secondary" onClick={close}>
              {t("Back to investigation", "Вернуться к расследованию")}
            </button>
          </div>
        </Dialog>
      )}
      {panel === "calendar" && (
        <Dialog title={t("Office calendar", "Календарь бюро")} onClose={close}>
          <div className="calendar-display">
            <span>{t("DATE IN THIS CASE", "ДАТА В ЭТОМ ДЕЛЕ")}</span>
            <strong>
              {caseData.gameDate || caseData.worldDate || "11/14/2026"}
            </strong>
            <p>
              {t("Dates in the records belong to this fictional timeline. Compare the invoice, payment and message dates carefully.", "Даты в документах относятся к вымышленным событиям дела. Внимательно сравнивайте даты счетов, платежей и сообщений.")}
            </p>
            <p className="notice">
              {t(`Your current play streak: ${getStreak()} day(s).`, `Дней игры подряд: ${getStreak()}.`)}
            </p>
          </div>
        </Dialog>
      )}
      {panel === "help" && (
        <Dialog title={t("A good detective follows the details.", "Хороший детектив замечает детали.")} onClose={close}>
          <ol className="how-to-list">
            <li>
              <strong>{t("Read the file.", "Прочитайте дело.")}</strong>{" "}
              {t("Your client has a story. The documents have another.", "У клиента своя версия. У документов — своя.")}
            </li>
            <li>
              <strong>{t("Follow a clue.", "Идите по следу.")}</strong>{" "}
              {t("Open the computer and click a highlighted name, company or reference in your record. You can also type it into the search bar.", "Откройте компьютер и нажмите на выделенное имя, название компании или номер в документе. Их также можно ввести в строку поиска.")}
            </li>
            <li>
              <strong>{t("Build your case.", "Соберите доказательства.")}</strong>{" "}
              {t("Pin records that support or contradict the story.", "Закрепляйте документы, которые подтверждают или опровергают версию событий.")}
            </li>
            <li>
              <strong>{t("Make a verdict.", "Вынесите вердикт.")}</strong>{" "}
              {t("Stamp the respondent GUILTY or NOT GUILTY, then choose who, how and two pieces of proof.", "Поставьте ответчику печать «ВИНОВЕН» или «НЕ ВИНОВЕН», затем выберите виновного, объяснение и два доказательства.")}
            </li>
          </ol>
          <p className="notice">
            {t("Three coffees, three attempts. Wrong conclusions cost 60 seconds and 150 additional points. Leaving the desk pauses the timer.", "Три чашки кофе — три попытки. Неверный вывод добавляет 60 секунд и дополнительно снимает 150 очков. Когда вы покидаете стол, таймер останавливается.")}
          </p>
        </Dialog>
      )}
    </main>
  );
}

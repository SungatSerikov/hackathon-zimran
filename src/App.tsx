import { useEffect, useState } from "react";
import { getLocalizedCases } from "./cases/localized";
import { useI18n } from "./i18n/I18n";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { Desk } from "./screens/Desk";
import { TitleScreen, CaseFiles } from "./screens/GameMenu";
import { Scene } from "./components/Scene";
import { Icon } from "./components/Icons";
import { FullscreenButton } from "./components/FullscreenButton";
import { Dialog } from "./components/Dialog";
import { loadRun, clearRun, safeRead, safeWrite } from "./lib/storage";
import { getWaitlist, joinWaitlist } from "./lib/records";
import { recordVisit } from "./lib/streak";
import { useGameAudio, type GameSound } from "./lib/gameAudio";
import type { CaseData } from "./types";

export default function App() {
  const { t, language } = useI18n();
  const cases = getLocalizedCases(language);
  const [screen, setScreen] = useState<"menu" | "cases" | "desk" | "duel">(
    "menu",
  );
  const [selectedId, setSelectedId] = useState(cases[0].id);
  const selected = cases.find(c => c.id === selectedId) || cases[0];
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
    setSelectedId(c.id);
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
              <i className="status-dot" /> {t("RIVERTON CONSUMER AFFAIRS", "РИВЕРТОН · БЮРО ЗАЩИТЫ ПОТРЕБИТЕЛЕЙ")}
            </span>
            <div className="menu-display-controls"><LanguageSwitcher /><button
              className="sound-switch"
              onClick={sound.toggle}
              aria-pressed={sound.enabled}
            >
              <Icon name="sound" size={16} />
              {sound.enabled ? t("SOUND ON", "ЗВУК ВКЛ") : t("SOUND OFF", "ЗВУК ВЫКЛ")}
            </button>
            <FullscreenButton /></div>
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
          title={t("Your first shift, explained.", "Ваша первая смена")}
          onClose={() => setModal(null)}
        >
          <ol className="how-to-list">
            <li>
              <strong>{t("Open the case folder.", "Откройте папку дела.")}</strong>{" "}
              {t("Read the complaint and the first documents. Notice names, dates, and reference numbers.", "Прочитайте жалобу и первые документы. Обращайте внимание на имена, даты и номера.")}
            </li>
            <li>
              <strong>{t("Use the archive.", "Воспользуйтесь архивом.")}</strong>{" "}
              {t("Type those clues into the computer to discover new records. Everything you need is inside the game.", "Введите найденные зацепки в компьютер, чтобы открыть новые документы. Всё необходимое есть внутри игры.")}
            </li>
            <li>
              <strong>{t("Pin your evidence.", "Закрепляйте улики.")}</strong>{" "}
              {t("Keep useful documents on your board, then compare the stories.", "Собирайте полезные документы на доске и сопоставляйте версии событий.")}
            </li>
            <li>
              <strong>{t("Make your call.", "Вынесите вердикт.")}</strong>{" "}
              {t("Stamp the respondent GUILTY or NOT GUILTY. Name the culprit, explain how, and support it with two records.", "Поставьте штамп «ВИНОВЕН» или «НЕ ВИНОВЕН» в отношении ответчика. Назовите настоящего виновника, объясните схему и подтвердите вывод двумя документами.")}
            </li>
          </ol>
          <button
            className="button"
            onClick={() => {
              setModal(null);
              play(cases[0]);
            }}
          >
            {t("Start the guided case", "Начать обучение")}
            <Icon name="arrow" />
          </button>
        </Dialog>
      )}
      {modal === "pass" && (
        <Dialog
          title={t("More cases. A new rival.", "Больше дел. Новый соперник.")}
          label={t("DETECTIVE PASS · COMING SOON", "DETECTIVE PASS · СКОРО")}
          onClose={() => setModal(null)}
        >
          <div className="pass-panel">
            <span className="pass-emblem">
              <Icon name="star" size={44} />
            </span>
            <p>{t("A new mystery every week. Someone to outthink next.", "Новое расследование каждую неделю. Новый соперник для ваших дедукций.")}</p>
            <div className="pass-price">
              $4.99<span>{t("/ month · planned price", "/ месяц · планируемая цена")}</span>
            </div>
            <ul aria-label={t("Planned Detective Pass benefits", "Будущие преимущества Detective Pass")}>
              <li className="pass-duel-benefit">
                <Icon name="people" size={20} />
                <span className="pass-benefit-copy">
                  <strong>{t("1v1 detective duels", "Детективные дуэли 1 на 1")} <span className="pass-soon">{t("COMING SOON", "СКОРО")}</span></strong>
                  <small><b>{t("Only with Detective Pass.", "Только с Detective Pass.")}</b>{" "}
                    {t("Two detectives, the same case. Race to name the culprit and prove it with evidence.", "Два детектива, одно дело. Найдите виновника и докажите его вину раньше соперника.")}</small>
                </span>
              </li>
              <li>
                <Icon name="check" size={17} />
                <span className="pass-benefit-copy">
                  <strong>{t("The complete case archive", "Полный архив расследований")}</strong>
                  <small>{t("Play every investigation, including subscriber-only cases.", "Проходите все дела, включая эксклюзивные расследования для подписчиков.")}</small>
                </span>
              </li>
              <li>
                <Icon name="check" size={17} />
                <span className="pass-benefit-copy">
                  <strong>{t("A fresh case every week", "Новое дело каждую неделю")}</strong>
                  <small>{t("New suspects, new clues, and another story to untangle.", "Новые подозреваемые, новые улики и новая история, которую предстоит распутать.")}</small>
                </span>
              </li>
              <li>
                <Icon name="check" size={17} />
                <span className="pass-benefit-copy">
                  <strong>{t("See the whole story after you solve it", "Полный разбор после прохождения")}</strong>
                  <small>{t("Unlock case breakdowns to connect the evidence and spot what you missed.", "Узнайте, как связаны улики и какие детали вы упустили.")}</small>
                </span>
              </li>
            </ul>
            <p className="cash-pack">
              {t("Optional cash pack · $500 bureau cash for $1.99", "Дополнительно: $500 игровой валюты за $1.99")}
              <br />
              <small>{t("Planned only. Not available for purchase.", "Пока в планах. Покупка недоступна.")}</small>
            </p>
            <button className="button" disabled>
              {t("Subscriptions are not available yet", "Подписка пока недоступна")}
            </button>
            <p className="fine-print">
              {t("This is a preview of the planned subscription. The two demo cases are free. No payment is collected.", "Это предварительное описание подписки. Два демонстрационных дела бесплатны. Оплата не взимается.")}
            </p>
          </div>
        </Dialog>
      )}
      {restart && (
        <Dialog title={t("Start this case again?", "Начать дело заново?")} onClose={() => setRestart(null)}>
          <p className="panel-intro">
            {t("This replaces your current attempt at", "Текущая попытка будет заменена для дела")}{" "}
            <strong>{cases.find(c => c.id === restart.id)?.title}</strong>.
            {t(" Your best score stays in the register.", " Лучший результат сохранится.")}
          </p>
          <div className="panel-actions">
            <button
              className="button secondary"
              onClick={() => setRestart(null)}
            >
              {t("Keep current attempt", "Продолжить текущую попытку")}
            </button>
            <button className="button" onClick={() => replay(restart)}>
              {t("Start fresh", "Начать заново")}
              <Icon name="arrow" />
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function Duel({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [interest, setInterest] = useState({
    count: 0,
    joined: false,
    source: "local" as "local" | "online",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
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
    setError(false);
    try {
      setInterest(await joinWaitlist());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="duel-page page-enter">
      <span className="badge">{t("COMING SOON · PASS EXCLUSIVE", "СКОРО · ТОЛЬКО ПО ПОДПИСКЕ")}</span>
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
        {t("Same case.", "Одно дело.")}
        <br />
        <em>{t("Two sharp minds.", "Два острых ума.")}</em>
      </h1>
      <p>
        {t("1v1 detective duels are coming exclusively to Detective Pass. Investigate the same file, follow your own trail, and see who can support the right conclusion first.", "Дуэли 1 на 1 скоро появятся только в Detective Pass. Расследуйте одно дело, идите по своим зацепкам и выясните, кто первым докажет правильную версию.")}
      </p>
      <div className="duel-rule">
        <Icon name="clock" />
        <span>
          {t("The first submission starts a short countdown for the other detective.", "Когда один детектив отправит ответ, у второго запустится короткий обратный отсчёт.")}
        </span>
      </div>
      <button
        className="button"
        disabled={interest.joined || busy}
        onClick={() => void join()}
      >
        {busy
          ? t("Recording…", "Сохраняем…")
          : interest.joined
            ? t("Interest recorded", "Ваш интерес учтён")
            : t("I’d play this", "Хочу сыграть")}
        <Icon name={interest.joined ? "check" : "arrow"} />
      </button>
      <span className="interest-count">
        {interest.source === "online"
          ? t(`${interest.count} detectives have registered interest`, `Ждут дуэлей: ${interest.count}`)
          : interest.joined
            ? t("Your interest is saved in this browser.", "Ваш интерес сохранён в этом браузере.")
            : t("Interest tracking is local to this browser.", "Интерес учитывается локально в этом браузере.")}
      </span>
      <p className="fine-print">
        {t("Duels are not playable yet. This button records interest; it does not subscribe you to notifications.", "Дуэли пока недоступны. Кнопка только фиксирует интерес и не подписывает вас на уведомления.")}
      </p>
      {error && <p role="alert">{t("Could not save your interest. Try again.", "Не удалось сохранить ваш интерес. Попробуйте ещё раз.")}</p>}
      <button className="text-button" onClick={onBack}>
        <Icon name="back" size={16} />
        {t("Play a solo case", "Играть в одиночку")}
      </button>
    </main>
  );
}

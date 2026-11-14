import { Icon } from "../components/Icons";
import { Asset } from "../components/Scene";
import type { CaseData } from "../types";
import { loadRun, safeRead } from "../lib/storage";
import { useI18n } from "../i18n/I18n";

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
  const { t } = useI18n();
  return (
    <main className="title-screen">
      <div className="title-content">
        <p className="title-kicker">
          <span /> {t("RIVERTON · AFTER HOURS", "РИВЕРТОН · ПОСЛЕ ПОЛУНОЧИ")}
        </p>
        <h1>
          CASE
          <span>
            DESK<span className="title-period">.</span>
          </span>
        </h1>
        <p className="title-tagline">
          {t("Everyone has a story.", "У каждого своя история.")}
          <br />
          {t("The evidence has another.", "У улик — другая.")}
        </p>
        <nav className="title-options" aria-label={t("Game menu", "Меню игры")}>
          {onContinue && (
            <button className="menu-choice main-choice" onClick={onContinue}>
              <span className="menu-arrow">▶</span>
              <span>
                {t("Continue", "Продолжить")}<small>{continueTitle}</small>
              </span>
            </button>
          )}
          <button
            className={`menu-choice ${!onContinue ? "main-choice" : ""}`}
            onClick={onCases}
          >
            <span className="menu-arrow">▶</span>
            <span>
              {onContinue ? t("Case files", "Дела") : t("Start investigating", "Начать расследование")}
              <small>{t("Two cases. A desk full of loose ends.", "Два дела. Стол, полный загадок.")}</small>
            </span>
          </button>
          <button className="menu-choice" onClick={onHelp}>
            <span className="menu-arrow">▶</span>{t("How to play", "Как играть")}
          </button>
          <button className="menu-choice" onClick={onDuel}>
            <span className="menu-arrow">▶</span>{t("Detective duels", "Дуэли детективов")}{" "}
            <span className="menu-soon">{t("SOON", "СКОРО")}</span>
          </button>
          <button className="menu-choice menu-pass" onClick={onPass}>
            <span className="menu-arrow">▶</span>Detective Pass{" "}
            <Icon name="lock" size={13} />
          </button>
        </nav>
      </div>
      <div className="title-caption">
        <span className="status-dot" /> {t("YOUR NEXT CASE IS WAITING.", "ВАШЕ СЛЕДУЮЩЕЕ ДЕЛО УЖЕ ЖДЁТ.")}
      </div>
      <span className="game-edition">{t("A PIXEL DETECTIVE GAME · DEMO 01", "ПИКСЕЛЬНЫЙ ДЕТЕКТИВ · ДЕМО 01")}</span>
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
  const { t } = useI18n();
  return (
    <main className="case-selection">
      <header className="selection-heading">
        <button className="game-back" onClick={onBack}>
          <Icon name="back" size={17} /> {t("Main menu", "Главное меню")}
        </button>
        <span>{t("RCA / ASSIGNMENTS", "БЮРО / ПОРУЧЕНИЯ")}</span>
      </header>
      <div className="selection-title">
        <span className="eyebrow">{t("THE IN-TRAY", "ВХОДЯЩИЕ ДЕЛА")}</span>
        <h1>{t("Choose your next case.", "Выберите следующее дело.")}</h1>
        <p>{t("Read the story. Follow the paper trail. Make your call.", "Изучите историю. Найдите улики. Вынесите вердикт.")}</p>
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
                {t("FILE", "ДЕЛО")} 00{i + 1} / {i === 0 ? t("TRAINING", "ОБУЧЕНИЕ") : t("OPEN CASE", "РАССЛЕДОВАНИЕ")}
              </div>
              <div className="dossier-top">
                <Asset
                  src={`/assets/portraits/${client.portrait}`}
                  className="dossier-photo"
                >
                  <span>{client.name[0]}</span>
                </Asset>
                <div>
                  <span className="eyebrow">{t("COMPLAINANT", "ЗАЯВИТЕЛЬ")}</span>
                  <strong>{client.name}</strong>
                  <span className="dossier-status">
                    {run?.status === "solved"
                      ? t("CASE CLOSED", "ДЕЛО ЗАКРЫТО")
                      : t("AWAITING REVIEW", "ОЖИДАЕТ РАССМОТРЕНИЯ")}
                  </span>
                </div>
                <span className="paperclip" aria-hidden="true" />
              </div>
              <h2>{c.title}</h2>
              <p>
                {i === 0
                  ? t("One repair. Two charges. Someone is counting on you not checking the paperwork.", "Один ремонт. Два списания. Кто-то надеется, что вы не станете проверять документы.")
                  : t("A returned jacket. A missing refund. Follow the package — someone along the way is lying.", "Куртку вернули, а деньги исчезли. Проследите путь посылки — кто-то в этой цепочке лжёт.")}
              </p>
              <div className="dossier-meta">
                <span>
                  <Icon name="clock" size={14} />
                  {c.estMinutes} {t("MIN", "МИН")}
                </span>
                <span>{i === 0 ? t("GUIDED CASE", "С ОБУЧЕНИЕМ") : "● ● ○"}</span>
              </div>
              {run?.status === "solved" && (
                <p className="dossier-best">
                  {t("Best report:", "Лучший результат:")} {typeof best === "number" ? best : 0} {t("points", "очков")}
                </p>
              )}
              <button
                className="dossier-play"
                data-sound="paper"
                onClick={() => onPlay(c)}
              >
                {run?.status === "playing"
                  ? t("Continue investigation", "Продолжить расследование")
                  : run
                    ? t("View case result", "Посмотреть результат")
                    : t("Accept case", "Взяться за дело")}
                <Icon name="arrow" size={18} />
              </button>
              {run && (
                <button className="dossier-replay" onClick={() => onReplay(c)}>
                  {t("Start a fresh attempt", "Начать новую попытку")}
                </button>
              )}
            </article>
          );
        })}
      </div>
      <button className="archive-seal" onClick={onPass}>
        <Icon name="lock" size={16} />
        <span>
          {t("MORE FILES IN THE ARCHIVE", "БОЛЬШЕ ДЕЛ В АРХИВЕ")}<small>{t("Detective Pass · coming later", "Detective Pass · скоро")}</small>
        </span>
        <Icon name="arrow" size={16} />
      </button>
    </main>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { CaseData, SearchKind } from "../types";
import type { GameRun } from "../store/game";
import { findReusableSearch, getDocumentClues } from "../engine/clues";
import { Dialog } from "./Dialog";
import { DocumentView, useDocumentLabels } from "./DocumentView";
import { Icon } from "./Icons";
import { RecordPicker } from "./RecordPicker";
import { useI18n } from "../i18n/I18n";

export function RecordsComputer({ caseData, run, selectedId, query,
  onQuery, onSearch, onSelect, onRead, onPin, onClose }: {
  caseData: CaseData;
  run: GameRun;
  selectedId: string;
  query: string;
  onQuery: (query: string) => void;
  onSearch: (query: string) => void;
  onSelect: (id: string) => void;
  onRead: (id: string) => void;
  onPin: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const docLabels = useDocumentLabels();
  const clueLabels: Record<SearchKind, string> = {
    name: t("Person", "Человек"), company: t("Company", "Компания"),
    phone: t("Phone", "Телефон"), address: t("Address", "Адрес"),
    order: t("Reference", "Номер"), email: t("Email", "Почта"),
    plate: t("Plate", "Госномер"), other: t("Detail", "Деталь"),
  };
  const documents = useMemo(() => caseData.documents.filter(doc => run.openedIds.includes(doc.id)),
    [caseData.documents, run.openedIds]);
  const source = documents.find(doc => doc.id === selectedId) ?? documents[0];
  const clues = useMemo(() => source ? getDocumentClues(source, caseData.searchIndex) : [],
    [source, caseData.searchIndex]);
  const [view, setView] = useState<"document" | "results">("document");
  const [activeIndex, setActiveIndex] = useState(run.queries.length - 1);
  const [reopened, setReopened] = useState(false);
  const [navigation, setNavigation] = useState<{ destination: "document" | "results" } | null>(null);
  const reader = useRef<HTMLElement>(null);
  const resultPane = useRef<HTMLElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const recordSelect = useRef<HTMLButtonElement>(null);
  const activeSearch = run.queries[activeIndex];
  const results = activeSearch?.documentIds.flatMap(id => {
    const doc = documents.find(item => item.id === id);
    return doc ? [doc] : [];
  }) ?? [];
  const pinned = !!source && run.pinnedIds.includes(source.id);

  useEffect(() => {
    if (source && !run.seenIds.includes(source.id)) onRead(source.id);
  }, [source, run.seenIds, onRead]);
  useEffect(() => {
    reader.current?.scrollTo({ top: 0 });
  }, [source?.id]);
  useEffect(() => {
    if (!navigation) return;
    if (navigation.destination === "results") {
      resultPane.current?.scrollTo({ top: 0 });
      resultHeading.current?.focus({ preventScroll: true });
    } else {
      reader.current?.scrollTo({ top: 0 });
      recordSelect.current?.focus({ preventScroll: true });
    }
  }, [navigation]);

  function navigate(destination: "document" | "results") {
    setView(destination);
    setNavigation({ destination });
  }

  function searchClue(value: string) {
    const clean = value.trim();
    if (!clean) return;
    onQuery(clean);
    const previous = findReusableSearch(caseData, run.openedIds, run.queries, clean);
    setReopened(previous >= 0);
    setActiveIndex(previous >= 0 ? previous : run.queries.length);
    if (previous < 0) onSearch(clean);
    navigate("results");
  }
  function openRecord(id: string) {
    onSelect(id);
    navigate("document");
  }

  return (
    <Dialog title={t("Records computer", "Архивный компьютер")} label={t(`RIVERTON PUBLIC RECORDS / CASE #${caseData.claim.number}`, `АРХИВ РИВЕРТОНА / ДЕЛО №${caseData.claim.number}`)}
      onClose={onClose} wide tone="records-computer">
      <div className="computer-toolbar">
        <div className="computer-connection"><span /> {t("RECORDS ONLINE", "АРХИВ НА СВЯЗИ")}</div>
        <p><strong>{t("Read a record.", "Изучите документ.")}</strong> {t("Click a highlighted detail. Follow what you find.", "Нажмите на выделенную деталь и продолжайте поиск.")}</p>
        <span className="computer-search-count">{t(`${run.queries.length} searches`, `Поисков: ${run.queries.length}`)}</span>
      </div>
      <form className="computer-search" onSubmit={event => { event.preventDefault(); searchClue(query); }}>
        <label htmlFor="records-query">{t("Search a name, company or reference", "Найдите имя, компанию или номер документа")}</label>
        <div className="computer-search-row">
          <Icon name="search" size={21} />
          <input id="records-query" aria-label={t("Search archive", "Поиск в архиве")} value={query}
            onChange={event => onQuery(event.target.value)} maxLength={120}
            placeholder={clues[0] ? t(`Try “${clues[0].query}”`, `Попробуйте «${clues[0].query}»`) : t("Use a detail from your case records", "Введите деталь из материалов дела")}
            autoComplete="off" spellCheck={false} />
          {query && <button className="computer-clear" type="button" onClick={() => onQuery("")}
            aria-label={t("Clear search", "Очистить поиск")}><Icon name="close" size={13} /></button>}
          <button className="computer-search-button" disabled={!query.trim()} type="submit">
            {t("Search", "Найти")} <Icon name="arrow" size={17} />
          </button>
        </div>
      </form>
      <nav className="computer-mobile-switch" aria-label={t("Computer panes", "Панели компьютера")}>
        <button aria-pressed={view === "document"} onClick={() => setView("document")}>
          <Icon name="file" size={16} /> {t("Read document", "Документ")}
        </button>
        <button aria-pressed={view === "results"} onClick={() => setView("results")}>
          <Icon name="search" size={16} /> {t("Search results", "Результаты поиска")} {activeSearch && <b>{results.length}</b>}
        </button>
      </nav>
      <div className="computer-workspace" data-view={view}>
        <section className="computer-reader" ref={reader} aria-label={t("Case document reader", "Просмотр материалов дела")}>
          <div className="computer-pane-heading">
            <span>{t("01 / YOUR CASE FILE", "01 / МАТЕРИАЛЫ ДЕЛА")}</span>
            <span>{t(`${documents.length} records`, `Документов: ${documents.length}`)}</span>
          </div>
          <div className="computer-source-picker">
            <Icon name="folder" size={22} />
            <RecordPicker documents={documents} seenIds={run.seenIds} value={source?.id ?? ""}
              onChange={openRecord} triggerRef={recordSelect} />
          </div>
          <div className="computer-leads">
            <div className="computer-leads-label"><Icon name="search" size={14} />
              <strong>{t("Details you can look up", "Детали для поиска")}</strong><span>{t("Click to search", "Нажмите для поиска")}</span>
            </div>
            {clues.length ? <div className="computer-lead-list">
              {clues.map(clue => <button key={clue.entryId} onClick={() => searchClue(clue.query)}
                title={t(`Search records for ${clue.query}`, `Поиск в архиве: ${clue.query}`)}>
                <small>{clueLabels[clue.kind]}</small><span>{clue.query}</span><Icon name="arrow" size={13} />
              </button>)}
            </div> : <p>{t("No searchable references in this record. Choose another record above.", "В этом документе нет зацепок для поиска. Выберите другой документ выше.")}</p>}
          </div>
          {source && <div className="computer-paper-wrap">
            <DocumentView doc={source} pinned={pinned} onPin={() => onPin(source.id)}
              clues={clues} onSearch={searchClue} />
            <p className="computer-pin-status" role="status">
              <Icon name={pinned ? "check" : "pin"} size={14} />
              {pinned ? t("Pinned to your evidence board.", "Закреплено на доске улик.") : t("Useful evidence? Pin the record after reading it.", "Важная улика? Прочитайте документ и закрепите его.")}
            </p>
          </div>}
        </section>
        <section className="computer-results" ref={resultPane} aria-label={t("Archive search results", "Результаты поиска в архиве")}>
          <div className="computer-pane-heading">
            <span>{t("02 / FOLLOW THE LEAD", "02 / ИДИТЕ ПО СЛЕДУ")}</span><Icon name="search" size={14} />
          </div>
          <div className="computer-results-content">
            {!activeSearch ? (
              <div className="computer-start">
                <div className="computer-start-icon"><Icon name="folder" size={36} /><Icon name="search" size={23} /></div>
                <span className="computer-section-label">{t("YOUR FIRST SEARCH", "ВАШ ПЕРВЫЙ ПОИСК")}</span>
                <h3 ref={resultHeading} tabIndex={-1}>{t("Start with a detail.", "Начните с детали.")}</h3>
                <p>{t("Names and numbers leave a paper trail. Click a highlighted detail in the record to look it up.", "Имена и номера оставляют след в документах. Нажмите на выделенную деталь, чтобы найти её в архиве.")}</p>
                {clues[0] ? <button className="computer-example" onClick={() => searchClue(clues[0].query)}>
                  <small>{t("TRY A DETAIL FROM THIS RECORD", "НАЙДИТЕ ДЕТАЛЬ ИЗ ЭТОГО ДОКУМЕНТА")}</small>
                  <span>{clues[0].query}<Icon name="arrow" size={18} /></span>
                </button> : <button className="computer-quiet-button" onClick={() => navigate("document")}>
                  {t("Choose a case record", "Выберите документ дела")} <Icon name="folder" size={16} />
                </button>}
                <ol className="computer-mini-guide">
                  <li><b>1</b><span>{t("Choose a detail", "Выберите деталь")}<strong>{t("A company, person, address or reference.", "Компанию, имя, адрес или номер документа.")}</strong></span></li>
                  <li><b>2</b><span>{t("Read what comes back", "Изучите результаты")}<strong>{t("Open a matching record to find the next lead.", "Откройте найденный документ и ищите следующую зацепку.")}</strong></span></li>
                  <li><b>3</b><span>{t("Keep the proof", "Сохраните доказательства")}<strong>{t("Pin evidence that supports your conclusion.", "Закрепите улики, которые подтверждают ваш вывод.")}</strong></span></li>
                </ol>
              </div>
            ) : (
              <>
                <div className="computer-result-summary" role="status" key={`${activeIndex}-${reopened}`}>
                  <span className="computer-section-label">{t("RESULTS FOR", "РЕЗУЛЬТАТЫ ПО ЗАПРОСУ")}</span>
                  <h3 ref={resultHeading} tabIndex={-1}>“{activeSearch.query}”</h3>
                  <p>{reopened ? t("Previous results reopened · no extra search.", "Прошлые результаты открыты · новый поиск не потрачен.") : activeSearch.newCount
                    ? t(`${activeSearch.newCount} new record${activeSearch.newCount === 1 ? "" : "s"} added to your case file.`, `Новых документов добавлено в дело: ${activeSearch.newCount}.`)
                    : results.length ? t("These records are already in your case file.", "Эти документы уже есть в материалах дела.") : t("No matching records found.", "Подходящих документов не найдено.")}</p>
                </div>
                {results.length ? <div className="computer-result-list">
                  {results.map(doc => <button key={doc.id} onClick={() => openRecord(doc.id)}>
                    <span className="computer-result-icon"><Icon name="file" size={25} /></span>
                    <span className="computer-result-copy"><small>{docLabels[doc.type]}
                      {!run.seenIds.includes(doc.id) && <b>{t("UNREAD", "НЕ ПРОЧИТАН")}</b>}</small>
                      <strong>{doc.title}</strong><span>{t("Open record", "Открыть документ")} <Icon name="arrow" size={13} /></span>
                    </span>
                    {run.pinnedIds.includes(doc.id) && <Icon name="pin" size={15} />}
                  </button>)}
                  <p className="computer-result-tip"><Icon name="file" size={14} />
                    {t("Open a record, then follow its highlighted details.", "Откройте документ и ищите по выделенным деталям.")}</p>
                </div> : <div className="computer-no-results">
                  <Icon name="search" size={30} /><h4>{t("Try a specific detail.", "Уточните запрос.")}</h4>
                  <p>{t("Use a name or reference from your records, rather than a full question. Check the spelling or choose another lead.", "Введите имя или номер из документов вместо целого вопроса. Проверьте написание или выберите другую зацепку.")}</p>
                  {clues[0] && <button className="computer-example" onClick={() => searchClue(clues[0].query)}>
                    <small>{t("FROM YOUR OPEN RECORD", "ИЗ ОТКРЫТОГО ДОКУМЕНТА")}</small><span>{clues[0].query}<Icon name="arrow" size={17} /></span>
                  </button>}
                  <button className="computer-quiet-button" onClick={() => navigate("document")}>{t("Read the source record", "Прочитать исходный документ")} <Icon name="back" size={14} /></button>
                </div>}
              </>
            )}
            {run.queries.length > 0 && <details className="computer-history">
              <summary><Icon name="clock" size={14} /> {t("Search history", "История поиска")} <span>{run.queries.length}</span></summary>
              <p>{t("Reopen past results without spending another search. Newly available records are checked again.", "Открывайте прошлые результаты без дополнительного поиска. Новые доступные документы проверяются повторно.")}</p>
              <div>{run.queries.map((item, index) => ({ item, index })).slice(-8).reverse().map(({ item, index }) =>
                <button key={index} onClick={() => searchClue(item.query)} aria-current={activeIndex === index ? "true" : undefined}>
                  <span>{item.query}</span><small>{t(`${item.documentIds.length} found`, `Найдено: ${item.documentIds.length}`)}</small><Icon name="arrow" size={12} />
                </button>,
              )}</div>
            </details>}
          </div>
        </section>
      </div>
      <footer className="computer-statusbar"><span><i /> {t("CASE FILE SYNCED", "ДЕЛО СИНХРОНИЗИРОВАНО")}</span>
        <span>{t(`${run.pinnedIds.length} pinned records`, `Закреплено: ${run.pinnedIds.length}`)}<span className="computer-keyboard-help"> · <kbd>Enter</kbd> {t("to search", "— поиск")}</span></span>
      </footer>
    </Dialog>
  );
}

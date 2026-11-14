import { useEffect, useMemo, useRef, useState } from "react";
import type { CaseData, SearchKind } from "../types";
import type { GameRun } from "../store/game";
import { findReusableSearch, getDocumentClues } from "../engine/clues";
import { Dialog } from "./Dialog";
import { DocumentView, docLabels } from "./DocumentView";
import { Icon } from "./Icons";

const clueLabels: Record<SearchKind, string> = {
  name: "Person", company: "Company", phone: "Phone", address: "Address",
  order: "Reference", email: "Email", plate: "Plate", other: "Detail",
};

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
  const recordSelect = useRef<HTMLSelectElement>(null);
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
    <Dialog title="Records computer" label={`RIVERTON PUBLIC RECORDS / CASE #${caseData.claim.number}`}
      onClose={onClose} wide tone="records-computer">
      <div className="computer-toolbar">
        <div className="computer-connection"><span /> RECORDS ONLINE</div>
        <p><strong>Read a record.</strong> Click a highlighted detail. Follow what you find.</p>
        <span className="computer-search-count">{run.queries.length} searches</span>
      </div>
      <form className="computer-search" onSubmit={event => { event.preventDefault(); searchClue(query); }}>
        <label htmlFor="records-query">Search a name, company or reference</label>
        <div className="computer-search-row">
          <Icon name="search" size={21} />
          <input id="records-query" aria-label="Search archive" value={query}
            onChange={event => onQuery(event.target.value)} maxLength={120}
            placeholder={clues[0] ? `Try “${clues[0].query}”` : "Use a detail from your case records"}
            autoComplete="off" spellCheck={false} />
          {query && <button className="computer-clear" type="button" onClick={() => onQuery("")}
            aria-label="Clear search"><Icon name="close" size={13} /></button>}
          <button className="computer-search-button" disabled={!query.trim()} type="submit">
            Search <Icon name="arrow" size={17} />
          </button>
        </div>
      </form>
      <nav className="computer-mobile-switch" aria-label="Computer panes">
        <button aria-pressed={view === "document"} onClick={() => setView("document")}>
          <Icon name="file" size={16} /> Read document
        </button>
        <button aria-pressed={view === "results"} onClick={() => setView("results")}>
          <Icon name="search" size={16} /> Search results {activeSearch && <b>{results.length}</b>}
        </button>
      </nav>
      <div className="computer-workspace" data-view={view}>
        <section className="computer-reader" ref={reader} aria-label="Case document reader">
          <div className="computer-pane-heading">
            <span>01 / YOUR CASE FILE</span>
            <span>{documents.length} records</span>
          </div>
          <div className="computer-source-picker">
            <Icon name="folder" size={22} />
            <div>
              <label htmlFor="computer-source">Read a record</label>
              <select id="computer-source" ref={recordSelect} value={source?.id ?? ""}
                onChange={event => openRecord(event.target.value)}>
                {documents.map(doc => <option value={doc.id} key={doc.id}>
                  {!run.seenIds.includes(doc.id) ? "NEW · " : ""}{doc.title}
                </option>)}
              </select>
            </div>
          </div>
          <div className="computer-leads">
            <div className="computer-leads-label"><Icon name="search" size={14} />
              <strong>Details you can look up</strong><span>Click to search</span>
            </div>
            {clues.length ? <div className="computer-lead-list">
              {clues.map(clue => <button key={clue.entryId} onClick={() => searchClue(clue.query)}
                title={`Search records for ${clue.query}`}>
                <small>{clueLabels[clue.kind]}</small><span>{clue.query}</span><Icon name="arrow" size={13} />
              </button>)}
            </div> : <p>No searchable references in this record. Choose another record above.</p>}
          </div>
          {source && <div className="computer-paper-wrap">
            <DocumentView doc={source} pinned={pinned} onPin={() => onPin(source.id)}
              clues={clues} onSearch={searchClue} />
            <p className="computer-pin-status" role="status">
              <Icon name={pinned ? "check" : "pin"} size={14} />
              {pinned ? "Pinned to your evidence board." : "Useful evidence? Pin the record after reading it."}
            </p>
          </div>}
        </section>
        <section className="computer-results" ref={resultPane} aria-label="Archive search results">
          <div className="computer-pane-heading">
            <span>02 / FOLLOW THE LEAD</span><Icon name="search" size={14} />
          </div>
          <div className="computer-results-content">
            {!activeSearch ? (
              <div className="computer-start">
                <div className="computer-start-icon"><Icon name="folder" size={36} /><Icon name="search" size={23} /></div>
                <span className="computer-section-label">YOUR FIRST SEARCH</span>
                <h3 ref={resultHeading} tabIndex={-1}>Start with a detail.</h3>
                <p>Names and numbers leave a paper trail. Click a highlighted detail in the record to look it up.</p>
                {clues[0] ? <button className="computer-example" onClick={() => searchClue(clues[0].query)}>
                  <small>TRY A DETAIL FROM THIS RECORD</small>
                  <span>{clues[0].query}<Icon name="arrow" size={18} /></span>
                </button> : <button className="computer-quiet-button" onClick={() => navigate("document")}>
                  Choose a case record <Icon name="folder" size={16} />
                </button>}
                <ol className="computer-mini-guide">
                  <li><b>1</b><span>Choose a detail<strong>A company, person, address or reference.</strong></span></li>
                  <li><b>2</b><span>Read what comes back<strong>Open a matching record to find the next lead.</strong></span></li>
                  <li><b>3</b><span>Keep the proof<strong>Pin evidence that supports your conclusion.</strong></span></li>
                </ol>
              </div>
            ) : (
              <>
                <div className="computer-result-summary" role="status" key={`${activeIndex}-${reopened}`}>
                  <span className="computer-section-label">RESULTS FOR</span>
                  <h3 ref={resultHeading} tabIndex={-1}>“{activeSearch.query}”</h3>
                  <p>{reopened ? "Previous results reopened · no extra search." : activeSearch.newCount
                    ? `${activeSearch.newCount} new record${activeSearch.newCount === 1 ? "" : "s"} added to your case file.`
                    : results.length ? "These records are already in your case file." : "No matching records found."}</p>
                </div>
                {results.length ? <div className="computer-result-list">
                  {results.map(doc => <button key={doc.id} onClick={() => openRecord(doc.id)}>
                    <span className="computer-result-icon"><Icon name="file" size={25} /></span>
                    <span className="computer-result-copy"><small>{docLabels[doc.type]}
                      {!run.seenIds.includes(doc.id) && <b>UNREAD</b>}</small>
                      <strong>{doc.title}</strong><span>Open record <Icon name="arrow" size={13} /></span>
                    </span>
                    {run.pinnedIds.includes(doc.id) && <Icon name="pin" size={15} />}
                  </button>)}
                  <p className="computer-result-tip"><Icon name="file" size={14} />
                    Open a record, then follow its highlighted details.</p>
                </div> : <div className="computer-no-results">
                  <Icon name="search" size={30} /><h4>Try a specific detail.</h4>
                  <p>Use a name or reference from your records, rather than a full question. Check the spelling or choose another lead.</p>
                  {clues[0] && <button className="computer-example" onClick={() => searchClue(clues[0].query)}>
                    <small>FROM YOUR OPEN RECORD</small><span>{clues[0].query}<Icon name="arrow" size={17} /></span>
                  </button>}
                  <button className="computer-quiet-button" onClick={() => navigate("document")}>Read the source record <Icon name="back" size={14} /></button>
                </div>}
              </>
            )}
            {run.queries.length > 0 && <details className="computer-history">
              <summary><Icon name="clock" size={14} /> Search history <span>{run.queries.length}</span></summary>
              <p>Reopen past results without spending another search. Newly available records are checked again.</p>
              <div>{run.queries.map((item, index) => ({ item, index })).slice(-8).reverse().map(({ item, index }) =>
                <button key={index} onClick={() => searchClue(item.query)} aria-current={activeIndex === index ? "true" : undefined}>
                  <span>{item.query}</span><small>{item.documentIds.length} found</small><Icon name="arrow" size={12} />
                </button>,
              )}</div>
            </details>}
          </div>
        </section>
      </div>
      <footer className="computer-statusbar"><span><i /> CASE FILE SYNCED</span>
        <span>{run.pinnedIds.length} pinned records · <kbd>Enter</kbd> to search</span>
      </footer>
    </Dialog>
  );
}

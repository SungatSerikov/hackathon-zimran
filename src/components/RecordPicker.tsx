import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { CaseDocument } from "../types";
import { docLabels } from "./DocumentView";
import { Icon } from "./Icons";

export function RecordPicker({ documents, seenIds, value, onChange, triggerRef }: {
  documents: CaseDocument[];
  seenIds: string[];
  value: string;
  onChange: (id: string) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef({ text: "", time: 0 });
  const selected = documents.find(doc => doc.id === value) ?? documents[0];
  const selectedIndex = Math.max(0, documents.findIndex(doc => doc.id === value));

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  useEffect(() => { setOpen(false); }, [value]);

  function expand(index = selectedIndex) {
    setActive(index);
    setOpen(true);
    typed.current = { text: "", time: 0 };
  }
  function choose(index: number) {
    const doc = documents[index];
    if (!doc) return;
    setOpen(false);
    onChange(doc.id);
    triggerRef.current?.focus({ preventScroll: true });
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!documents.length || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      if (!open) expand();
      else setActive(index => Math.max(0, Math.min(documents.length - 1, index + (key === "ArrowDown" ? 1 : -1))));
    } else if (key === "Home" || key === "End") {
      event.preventDefault();
      expand(key === "Home" ? 0 : documents.length - 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else expand();
    } else if (key === "Tab") {
      setOpen(false);
    } else if (key.length === 1) {
      event.preventDefault();
      const now = Date.now();
      const prefix = now - typed.current.time < 700 ? typed.current.text + key.toLowerCase() : key.toLowerCase();
      typed.current = { text: prefix, time: now };
      const index = documents.findIndex(doc => doc.title.toLowerCase().startsWith(prefix));
      if (index >= 0) { setActive(index); setOpen(true); }
    }
  }

  return <div className="record-picker" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span className="record-picker-label" id={`${id}-label`}>Read a record</span>
    <button id="computer-source" ref={triggerRef} type="button" role="combobox"
      className="record-picker-trigger" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? `${id}-list` : undefined}
      aria-labelledby={`${id}-label ${id}-value`}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      disabled={!documents.length} onKeyDown={onKeyDown}
      onClick={() => { if (open) setOpen(false); else expand(); }}>
      <span id={`${id}-value`}>{selected?.title ?? "No records yet"}</span>
      <span className="record-picker-chevron"><Icon name="arrow" size={14} /></span>
    </button>
    {open && <div className="record-picker-menu">
      <div className="record-picker-heading" aria-hidden="true"><span>CASE FILE</span><span>{documents.length} RECORDS</span></div>
      <div id={`${id}-list`} ref={list} role="listbox" aria-labelledby={`${id}-label`} className="record-picker-list">
        {documents.map((doc, index) => <div key={doc.id} id={`${id}-option-${index}`} role="option"
          aria-selected={doc.id === selected?.id} className={`record-picker-option ${active === index ? "is-active" : ""}`}
          onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()}
          onClick={() => choose(index)}>
          <span className="record-picker-file"><Icon name="file" size={19} /></span>
          <span className="record-picker-copy"><span className="record-picker-meta">{docLabels[doc.type]}
            {!seenIds.includes(doc.id) && <b>NEW</b>}</span><span>{doc.title}</span></span>
          <span className="record-picker-check">{doc.id === selected?.id && <Icon name="check" size={14} />}</span>
        </div>)}
      </div>
      <div className="record-picker-footer" aria-hidden="true">↑ ↓ CHOOSE <span>ENTER OPEN · ESC CLOSE</span></div>
    </div>}
  </div>;
}

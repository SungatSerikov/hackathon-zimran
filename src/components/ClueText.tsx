import { Fragment } from "react";
import { splitClueText, type DocumentClue } from "../engine/clues";

export function ClueText({ text, clues, onSearch }: {
  text: string;
  clues: DocumentClue[];
  onSearch: (query: string) => void;
}) {
  return <>{splitClueText(text, clues).map((part, i) =>
    part.clue ? (
      <button
        type="button"
        className="inline-clue"
        key={i}
        aria-label={`Search records for ${part.text}`}
        title={`Search records for ${part.text}`}
        onClick={() => onSearch(part.clue!.query)}
      >{part.text}</button>
    ) : <Fragment key={i}>{part.text}</Fragment>,
  )}</>;
}

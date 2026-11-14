import { Fragment } from "react";
import { splitClueText, type DocumentClue } from "../engine/clues";
import { useI18n } from "../i18n/I18n";

export function ClueText({ text, clues, onSearch }: {
  text: string;
  clues: DocumentClue[];
  onSearch: (query: string) => void;
}) {
  const { t } = useI18n();
  return <>{splitClueText(text, clues).map((part, i) =>
    part.clue ? (
      <button
        type="button"
        className="inline-clue"
        key={i}
        aria-label={t(`Search records for ${part.text}`, `Поиск в архиве: ${part.text}`)}
        title={t(`Search records for ${part.text}`, `Поиск в архиве: ${part.text}`)}
        onClick={() => onSearch(part.clue!.query)}
      >{part.text}</button>
    ) : <Fragment key={i}>{part.text}</Fragment>,
  )}</>;
}

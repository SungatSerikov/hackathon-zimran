import type { CaseDocument, DocumentType } from "../types";
import { useI18n } from "../i18n/I18n";
import { Icon } from "./Icons";
import { ClueText } from "./ClueText";
import type { DocumentClue } from "../engine/clues";
export const docLabels: Record<string, string> = {
  receipt: "Invoice",
  contract: "Agreement",
  chat: "Conversation",
  email: "Email",
  ad: "Public listing",
  bank_statement: "Bank record",
  note: "Case note",
  record: "Official record",
};
export function useDocumentLabels(): Record<DocumentType, string> {
  const { t } = useI18n();
  return {
    receipt: t("Invoice", "Счёт"),
    contract: t("Agreement", "Договор"),
    chat: t("Conversation", "Переписка"),
    email: t("Email", "Письмо"),
    ad: t("Public listing", "Объявление"),
    bank_statement: t("Bank record", "Банковская выписка"),
    note: t("Case note", "Заметка по делу"),
    record: t("Official record", "Официальный документ"),
  };
}
const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v,
  );
export function DocumentView({
  doc,
  pinned,
  onPin,
  clues = [],
  onSearch,
}: {
  doc: CaseDocument;
  pinned: boolean;
  onPin: () => void;
  clues?: DocumentClue[];
  onSearch?: (query: string) => void;
}) {
  const { t } = useI18n();
  const labels = useDocumentLabels();
  const b = doc.body;
  const text = (value: string | undefined) => value && onSearch
    ? <ClueText text={value} clues={clues} onSearch={onSearch} />
    : value;
  return (
    <article className={`paper paper-${doc.type}`}>
      <div className="paper-top">
        <span className="eyebrow">{labels[doc.type]} · {t("EVIDENCE COPY", "КОПИЯ ДЛЯ ДЕЛА")}</span>
        <Icon name="file" />
      </div>
      <h3>{text(doc.title)}</h3>
      {doc.type === "receipt" && (
        <>
          <h4>{text(b.vendor)}</h4>
          <dl className="paper-meta">
            <div>
              <dt>{t("Invoice", "Счёт")}</dt>
              <dd>{text(b.number)}</dd>
            </div>
            <div>
              <dt>{t("Date", "Дата")}</dt>
              <dd>{text(b.date)}</dd>
            </div>
          </dl>
          <div className="receipt-lines">
            {b.items?.map((x, i) => (
              <div key={i}>
                <span>{text(x.name)}</span>
                <strong>{money(x.amount)}</strong>
              </div>
            ))}
            <div className="receipt-total">
              <span>{t("Total", "Итого")}</span>
              <strong>{money(b.total || 0)}</strong>
            </div>
          </div>
          <p className="paper-footnote">{t("Payment", "Оплата")}: {text(b.paymentMethod)}</p>
          {b.body && <p className="document-prose">{text(b.body)}</p>}
        </>
      )}
      {doc.type === "contract" && (
        <>
          <p className="paper-footnote">
            {text(b.date)} · {text(b.parties?.join(" / "))}
          </p>
          <ol className="clauses">
            {b.clauses?.map((s, i) => (
              <li key={i}>{text(s)}</li>
            ))}
          </ol>
        </>
      )}
      {doc.type === "chat" && (
        <>
          <p className="paper-footnote">{text(b.participants?.join(" ↔ "))}</p>
          <div className="chat-messages">
            {b.messages?.map((m, i) => (
              <section className={i % 2 ? "chat-alt" : ""} key={i}>
                <header>
                  <strong>{text(m.from)}</strong>
                  <time>{text(m.time)}</time>
                </header>
                <p>{text(m.text)}</p>
              </section>
            ))}
          </div>
        </>
      )}
      {doc.type === "email" && (
        <>
          <dl className="paper-meta">
            <div>
              <dt>{t("From", "От")}</dt>
              <dd>{text(b.from)}</dd>
            </div>
            <div>
              <dt>{t("To", "Кому")}</dt>
              <dd>{text(b.to)}</dd>
            </div>
            <div>
              <dt>{t("Date", "Дата")}</dt>
              <dd>{text(b.date)}</dd>
            </div>
            <div>
              <dt>{t("Subject", "Тема")}</dt>
              <dd>{text(b.subject)}</dd>
            </div>
          </dl>
          <p className="document-prose">{text(b.body)}</p>
        </>
      )}
      {doc.type === "ad" && (
        <div className="ad-copy">
          <h4>{text(b.headline)}</h4>
          <p>{text(b.body)}</p>
          {b.phone && <p>{t("Phone", "Телефон")}: {text(b.phone)}</p>}
          {b.address && <p>{text(b.address)}</p>}
        </div>
      )}
      {doc.type === "bank_statement" && (
        <>
          <h4>{text(b.owner)}</h4>
          <div className="table-scroll">
            <table className="statement">
              <thead>
                <tr>
                  <th>{t("Date", "Дата")}</th>
                  <th>{t("Description", "Описание")}</th>
                  <th>{t("Amount", "Сумма")}</th>
                </tr>
              </thead>
              <tbody>
                {b.rows?.map((r, i) => (
                  <tr key={i}>
                    <td>{text(r.date)}</td>
                    <td>{text(r.description)}</td>
                    <td>{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {(doc.type === "note" || doc.type === "record") && (
        <>
          {b.heading && <h4>{text(b.heading)}</h4>}
          <p className="document-prose">{text(b.body)}</p>
        </>
      )}
      <footer className="paper-footer">
        <span>
          {t("RIVERTON CONSUMER AFFAIRS", "ЗАЩИТА ПОТРЕБИТЕЛЕЙ РИВЕРТОНА")}
          <br />
          {t("For investigative use only", "Только для расследования")}
        </span>
        <button
          className={`button small ${pinned ? "pinned" : ""}`}
          onClick={onPin}
        >
          <Icon name="pin" size={16} />
          {pinned ? t("Pinned · remove", "Закреплено · убрать") : t("Pin as evidence", "Закрепить улику")}
        </button>
      </footer>
    </article>
  );
}

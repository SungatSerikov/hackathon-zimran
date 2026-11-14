import type { CaseDocument } from "../types";
import { Icon } from "./Icons";
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
const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v,
  );
export function DocumentView({
  doc,
  pinned,
  onPin,
}: {
  doc: CaseDocument;
  pinned: boolean;
  onPin: () => void;
}) {
  const b = doc.body;
  return (
    <article className={`paper paper-${doc.type}`}>
      <div className="paper-top">
        <span className="eyebrow">{docLabels[doc.type]} · EVIDENCE COPY</span>
        <Icon name="file" />
      </div>
      <h3>{doc.title}</h3>
      {doc.type === "receipt" && (
        <>
          <h4>{b.vendor}</h4>
          <dl className="paper-meta">
            <div>
              <dt>Invoice</dt>
              <dd>{b.number}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{b.date}</dd>
            </div>
          </dl>
          <div className="receipt-lines">
            {b.items?.map((x, i) => (
              <div key={i}>
                <span>{x.name}</span>
                <strong>{money(x.amount)}</strong>
              </div>
            ))}
            <div className="receipt-total">
              <span>Total</span>
              <strong>{money(b.total || 0)}</strong>
            </div>
          </div>
          <p className="paper-footnote">Payment: {b.paymentMethod}</p>
          {b.body && <p className="document-prose">{b.body}</p>}
        </>
      )}
      {doc.type === "contract" && (
        <>
          <p className="paper-footnote">
            {b.date} · {b.parties?.join(" / ")}
          </p>
          <ol className="clauses">
            {b.clauses?.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </>
      )}
      {doc.type === "chat" && (
        <>
          <p className="paper-footnote">{b.participants?.join(" ↔ ")}</p>
          <div className="chat-messages">
            {b.messages?.map((m, i) => (
              <section className={i % 2 ? "chat-alt" : ""} key={i}>
                <header>
                  <strong>{m.from}</strong>
                  <time>{m.time}</time>
                </header>
                <p>{m.text}</p>
              </section>
            ))}
          </div>
        </>
      )}
      {doc.type === "email" && (
        <>
          <dl className="paper-meta">
            <div>
              <dt>From</dt>
              <dd>{b.from}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{b.to}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{b.date}</dd>
            </div>
            <div>
              <dt>Subject</dt>
              <dd>{b.subject}</dd>
            </div>
          </dl>
          <p className="document-prose">{b.body}</p>
        </>
      )}
      {doc.type === "ad" && (
        <div className="ad-copy">
          <h4>{b.headline}</h4>
          <p>{b.body}</p>
          {b.phone && <p>Phone: {b.phone}</p>}
          {b.address && <p>{b.address}</p>}
        </div>
      )}
      {doc.type === "bank_statement" && (
        <>
          <h4>{b.owner}</h4>
          <div className="table-scroll">
            <table className="statement">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {b.rows?.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.description}</td>
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
          {b.heading && <h4>{b.heading}</h4>}
          <p className="document-prose">{b.body}</p>
        </>
      )}
      <footer className="paper-footer">
        <span>
          RIVERTON CONSUMER AFFAIRS
          <br />
          For investigative use only
        </span>
        <button
          className={`button small ${pinned ? "pinned" : ""}`}
          onClick={onPin}
        >
          <Icon name="pin" size={16} />
          {pinned ? "Pinned · remove" : "Pin as evidence"}
        </button>
      </footer>
    </article>
  );
}

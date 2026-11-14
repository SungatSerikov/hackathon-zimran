import { useMemo, useState } from "react";
import type { CaseData } from "../types";
import type { GameRun } from "../store/game";
import { getWallet, purchaseHint } from "../engine/wallet";
import { getNextHint, type HintOffer } from "../engine/hint";
import { Dialog } from "./Dialog";
import { Icon } from "./Icons";
export const bureauMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

export function EconomyPanel({
  mode,
  caseData,
  run,
  onClose,
  onHint,
  onSearch,
  onPaywall,
  onBalance,
}: {
  mode: "wallet" | "hint";
  caseData: CaseData;
  run: GameRun;
  onClose: () => void;
  onHint: (hint: HintOffer) => void;
  onSearch: (query: string) => void;
  onPaywall: () => void;
  onBalance: (balance: number) => void;
}) {
  const [wallet, setWallet] = useState(getWallet);
  const [notice, setNotice] = useState("");
  const offer = useMemo(
    () =>
      mode === "hint"
        ? getNextHint(
            caseData,
            run.openedIds,
            run.queries.map((q) => q.query),
            run.hints,
          )
        : null,
    [mode, caseData, run.openedIds, run.queries, run.hints],
  );
  function buy() {
    if (!offer || offer.free) return;
    const result = purchaseHint(caseData, run, offer);
    if (!result.success) {
      onClose();
      onPaywall();
      return;
    }
    setWallet(result.wallet);
    onBalance(result.wallet.balance);
    onHint(offer);
    setNotice(
      result.charged
        ? `${bureauMoney(result.charged)} bureau cash spent. −50 points on this case.`
        : "This hint was already paid for; no additional charge.",
    );
  }
  return (
    <Dialog
      title={mode === "wallet" ? "Your bureau safe" : "Call the informant"}
      label="BUREAU CASH · FICTIONAL GAME CURRENCY"
      onClose={onClose}
    >
      <div className="wallet-balance">
        <Icon name={mode === "wallet" ? "lock" : "phone"} size={32} />
        <div>
          <span className="eyebrow">AVAILABLE BALANCE</span>
          <strong>{bureauMoney(wallet.balance)}</strong>
        </div>
      </div>
      {mode === "wallet" ? (
        <>
          <p className="panel-intro">
            Close cases to earn your fee. Spend bureau cash on a nudge when the
            paper trail runs cold.
          </p>
          <div className="wallet-history">
            <span className="eyebrow">RECENT ACTIVITY</span>
            {wallet.history.length ? (
              wallet.history
                .slice(-10)
                .reverse()
                .map((item, i) => (
                  <div key={`${item.ts}-${i}`}>
                    <span>
                      {item.reason.replace(/[-_]/g, " ")}
                      <small>
                        {new Date(item.ts).toLocaleDateString("en-US")}
                      </small>
                    </span>
                    <strong className={item.amount < 0 ? "spent" : ""}>
                      {item.amount >= 0 ? "+" : ""}
                      {bureauMoney(item.amount)}
                    </strong>
                  </div>
                ))
            ) : (
              <p>
                Your $100 starting allowance is ready. Finish a case to earn
                your first fee.
              </p>
            )}
          </div>
          <button
            className="button secondary"
            onClick={() => {
              onClose();
              onPaywall();
            }}
          >
            Cash packs · coming later
            <Icon name="arrow" size={16} />
          </button>
        </>
      ) : (
        <>
          <p className="panel-intro">
            A discreet call can point you toward a clue you already have. A
            second call about the same step gives the exact search.
          </p>
          {run.hints.length > 0 && (
            <div className="hint-history">
              {run.hints.map((hint, i) => (
                <div key={`${hint.stepKey}-${hint.level}`}>
                  <span className="eyebrow">
                    CALL {i + 1} ·{" "}
                    {hint.level === 1 ? "A NUDGE" : "EXACT QUERY"}
                  </span>
                  <p>{hint.message}</p>
                  {hint.query && (
                    <button
                      className="text-button"
                      onClick={() => onSearch(hint.query!)}
                    >
                      Use this query
                      <Icon name="arrow" size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {offer?.free && (
            <div className="free-hint">
              <Icon name="check" size={19} />
              <p>{offer.message}</p>
              {offer.query && (
                <button
                  className="text-button"
                  onClick={() => onSearch(offer.query!)}
                >
                  Search →
                </button>
              )}
            </div>
          )}
          {offer && !offer.free && (
            <button className="button hint-buy" onClick={buy}>
              {wallet.balance < 40
                ? "Not enough cash · see options"
                : offer.level === 1
                  ? "Get a nudge · $40"
                  : "Reveal the query · $40"}
              <Icon name="phone" size={18} />
            </button>
          )}
          <p className="fine-print">
            Each paid call costs $40 bureau cash and 50 score points. Final
            guidance is free. No real money is spent.
          </p>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}

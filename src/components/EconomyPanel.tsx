import { useMemo, useState } from "react";
import type { CaseData } from "../types";
import type { GameRun } from "../store/game";
import { getWallet, purchaseHint } from "../engine/wallet";
import { getNextHint, type HintOffer } from "../engine/hint";
import { useI18n } from "../i18n/I18n";
import { presentHint } from "../i18n/hints";
import { Dialog } from "./Dialog";
import { Icon } from "./Icons";
export const bureauMoney = (value: number, locale = "en-US") =>
  new Intl.NumberFormat(locale, {
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
  const { language, locale, t } = useI18n();
  const [wallet, setWallet] = useState(getWallet);
  const [notice, setNotice] = useState<{ charged: number } | null>(null);
  const money = (value: number) => bureauMoney(value, locale);
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
  const displayedOffer = offer ? presentHint(offer, caseData, language, run.openedIds) : null;
  const historyReason = (reason: string) => {
    const labels: Record<string, string> = {
      "Case fee": t("Case fee", "Гонорар за дело"),
      "Repeat case fee": t("Repeat case fee", "Гонорар за повторное прохождение"),
      "Informant hint": t("Informant hint", "Подсказка информатора"),
    };
    return labels[reason] ?? reason.replace(/[-_]/g, " ");
  };
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
    setNotice({ charged: result.charged });
  }
  return (
    <Dialog
      title={mode === "wallet" ? t("Your bureau safe", "Сейф вашего бюро") : t("Call the informant", "Звонок информатору")}
      label={t("BUREAU CASH · FICTIONAL GAME CURRENCY", "ДЕНЬГИ БЮРО · ВЫМЫШЛЕННАЯ ИГРОВАЯ ВАЛЮТА")}
      onClose={onClose}
      tone={mode === "wallet" ? "safe-dialog" : "phone-dialog"}
    >
      <div className="wallet-balance">
        <Icon name={mode === "wallet" ? "lock" : "phone"} size={32} />
        <div>
          <span className="eyebrow">{t("AVAILABLE BALANCE", "ДОСТУПНЫЙ БАЛАНС")}</span>
          <strong>{money(wallet.balance)}</strong>
        </div>
      </div>
      {mode === "wallet" ? (
        <>
          <p className="panel-intro">
            {t("Close cases to earn your fee. Spend bureau cash on a nudge when the paper trail runs cold.",
              "Закрывайте дела и получайте гонорар. Если расследование зашло в тупик, потратьте деньги бюро на подсказку.")}
          </p>
          <div className="wallet-history">
            <span className="eyebrow">{t("RECENT ACTIVITY", "ПОСЛЕДНИЕ ОПЕРАЦИИ")}</span>
            {wallet.history.length ? (
              wallet.history
                .slice(-10)
                .reverse()
                .map((item, i) => (
                  <div key={`${item.ts}-${i}`}>
                    <span>
                      {historyReason(item.reason)}
                      <small>
                        {new Date(item.ts).toLocaleDateString(locale)}
                      </small>
                    </span>
                    <strong className={item.amount < 0 ? "spent" : ""}>
                      {item.amount >= 0 ? "+" : ""}
                      {money(item.amount)}
                    </strong>
                  </div>
                ))
            ) : (
              <p>
                {t("Your $100 starting allowance is ready. Finish a case to earn your first fee.",
                  "На вашем счету уже есть стартовые $100. Закройте дело, чтобы получить первый гонорар.")}
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
            {t("Cash packs · coming later", "Наборы валюты · скоро")}
            <Icon name="arrow" size={16} />
          </button>
        </>
      ) : (
        <>
          <p className="panel-intro">
            {t("A discreet call can point you toward a clue you already have. A second call about the same step gives the exact search.",
              "Информатор подскажет, на какую уже найденную зацепку обратить внимание. Второй звонок по тому же шагу даст точный поисковый запрос.")}
          </p>
          {run.hints.length > 0 && (
            <div className="hint-history">
              {run.hints.map((hint, i) => {
                const displayed = presentHint(hint, caseData, language, run.openedIds);
                return (
                  <div key={`${hint.stepKey}-${hint.level}`}>
                    <span className="eyebrow">
                      {t("CALL", "ЗВОНОК")} {i + 1} ·{" "}
                      {hint.level === 1 ? t("A NUDGE", "ПОДСКАЗКА") : t("EXACT QUERY", "ТОЧНЫЙ ЗАПРОС")}
                    </span>
                    <p>{displayed.message}</p>
                    {displayed.query && (
                      <button
                        className="text-button"
                        onClick={() => onSearch(displayed.query!)}
                      >
                        {t("Use this query", "Использовать запрос")}
                        <Icon name="arrow" size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {offer?.free && displayedOffer && (
            <div className="free-hint">
              <Icon name="check" size={19} />
              <p>{displayedOffer.message}</p>
              {displayedOffer.query && (
                <button
                  className="text-button"
                  onClick={() => onSearch(displayedOffer.query!)}
                >
                  {t("Search →", "Найти →")}
                </button>
              )}
            </div>
          )}
          {offer && !offer.free && (
            <button className="button hint-buy" onClick={buy}>
              {wallet.balance < 40
                ? t("Not enough cash · see options", "Недостаточно денег · варианты")
                : offer.level === 1
                  ? t("Get a nudge · $40", "Получить подсказку · $40")
                  : t("Reveal the query · $40", "Узнать точный запрос · $40")}
              <Icon name="phone" size={18} />
            </button>
          )}
          <p className="fine-print">
            {t("Each paid call costs $40 bureau cash and 50 score points. Final guidance is free. No real money is spent.",
              "Каждый платный звонок стоит $40 из средств бюро и 50 очков. Финальная подсказка бесплатна. Настоящие деньги не тратятся.")}
          </p>
          {notice && (
            <p className="notice" role="status">
              {notice.charged
                ? t(`${money(notice.charged)} bureau cash spent. −50 points on this case.`,
                  `Потрачено ${money(notice.charged)} из средств бюро. −50 очков за это дело.`)
                : t("This hint was already paid for; no additional charge.",
                  "Эта подсказка уже оплачена; повторного списания нет.")}
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}

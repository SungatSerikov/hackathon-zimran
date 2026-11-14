import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icons";
import { useI18n } from "../i18n/I18n";

export function Dialog({
  title,
  label,
  children,
  onClose,
  wide = false,
  tone = "",
}: {
  title: string;
  label?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  tone?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.showModal();
    return () => {
      el?.close();
      previouslyFocused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""} ${tone}`}
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close.current();
        }
      }}
    >
      <header className="dialog-bar">
        <div>
          <span className="eyebrow">
            {label || t("CASE DESK · BUREAU TERMINAL", "CASE DESK · ТЕРМИНАЛ БЮРО")}
          </span>
          <h2 id={heading}>{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t("Close window", "Закрыть окно")}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}

import { useState, type CSSProperties, type ReactNode } from "react";
import layout from "../scene/layout.json";
import spriteMeta from "../scene/sprite-meta.json";
import { Icon } from "./Icons";
import { useI18n } from "../i18n/I18n";
declare const __SCENE_ASSETS__: string[];
const availableAssets = new Set(__SCENE_ASSETS__);
export type DeskAction =
  | "clock"
  | "calendar"
  | "board"
  | "monitor"
  | "safe"
  | "coffee"
  | "folder"
  | "stamps"
  | "phone"
  | "cabinet";
const activeSprites: Partial<Record<DeskAction, string>> = {
  phone: "scene/phone_ring.png",
  folder: "scene/folder_open.png",
  monitor: "scene/monitor_on.png",
  safe: "scene/safe_open.png",
};
const calendarMonths = {
  en: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  ru: ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"],
};
const objectLabelsRu: Record<string, string> = {
  clock: "Часы", calendar: "Календарь", board: "Доска улик",
  monitor: "Компьютер", safe: "Сейф (ваши деньги)", cabinet: "Архив дел",
  phone: "Позвонить информатору", coffee_1: "Жизнь 1", coffee_2: "Жизнь 2",
  coffee_3: "Жизнь 3", folder: "Материалы дела", stamps: "Печати вердикта",
};
export function Asset({
  src,
  children,
  className = "",
}: {
  src: string;
  children?: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`asset ${className}`}>
      {!failed && availableAssets.has(src) && (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          onLoad={(e) =>
            e.currentTarget.parentElement?.classList.add("asset-loaded")
          }
        />
      )}
      {children && <span className="asset-fallback">{children}</span>}
    </span>
  );
}
export function formatTime(s: number) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function Scene({
  onAction,
  elapsed = 0,
  lives = 3,
  evidence = 0,
  balance = 100,
  hero = false,
  date = "11/14/2026",
  showHotspots = false,
  highlight,
  activeObject,
}: {
  onAction?: (action: DeskAction) => void;
  elapsed?: number;
  lives?: number;
  evidence?: number;
  balance?: number;
  hero?: boolean;
  date?: string;
  showHotspots?: boolean;
  highlight?: string;
  activeObject?: DeskAction;
}) {
  const { language, locale, t } = useI18n();
  const [month, day, year] = date.split("/").map(Number);
  const calendarDate = new Date(year, month - 1, day);
  const weekday = Number.isNaN(calendarDate.getTime()) ? "" :
    calendarDate.toLocaleDateString(locale, { weekday: "long" }).toLocaleUpperCase(locale);
  const monthLabel = calendarMonths[language][month - 1] ?? "";
  return (
    <div
      className={`scene-shell ${hero ? "scene-hero" : ""} ${showHotspots ? "show-hotspots" : ""}`}
    >
      <div
        className="scene"
        aria-label={hero ? t("A cozy detective office", "Уютный кабинет детектива") : t("Detective desk", "Стол детектива")}
      >
        <Asset
          src={`/assets/${layout.background}`}
          className="scene-background"
        >
          <div className="wall-panels" />
          <div className="scene-window">
            <div className="window-moon" />
            <i />
            <i />
            <i />
          </div>
          <div className="desk-surface" />
          <div className="desk-front" />
        </Asset>
        {!availableAssets.has(`/assets/${layout.background}`) && (
          <div className="scene-lamp"><i /><b /><span /></div>
        )}
        <div className="desk-mat" aria-hidden="true" />
        <div className="desk-pen" />
        <div className="office-plaque">
          {t("RIVERTON", "РИВЕРТОН")}
          <br />
          <strong>{t("CONSUMER AFFAIRS", "ЗАЩИТА ПОТРЕБИТЕЛЕЙ")}</strong>
        </div>
        {layout.objects.map((item) => {
          const label = t(item.label, objectLabelsRu[item.id] ?? item.label);
          const variant = item.id.startsWith("coffee_") && Number(item.id.slice(-1)) > lives
            ? "scene/coffee_empty.png"
            : item.id === activeObject ? activeSprites[activeObject] : undefined;
          const sprite = `/assets/${variant && availableAssets.has(`/assets/${variant}`) ? variant : item.sprite}`;
          const style = {
            left: `${(item.x / layout.base.w) * 100}%`,
            top: `${(item.y / layout.base.h) * 100}%`,
            width: `${(item.w / layout.base.w) * 100}%`,
            height: `${(item.h / layout.base.h) * 100}%`,
            zIndex: item.z + 2,
          } as CSSProperties;
          const fallback = (
            <>
              {item.id === "clock" && (
                <div className="pixel-clock">
                  <i />
                  <b />
                  <span />
                </div>
              )}
              {item.id === "calendar" && (
                <div className="pixel-calendar">
                  <span>{monthLabel}</span>
                  <strong>{date.split("/")[1] || "14"}</strong>
                  <small>{weekday}</small>
                </div>
              )}
              {item.id === "board" && (
                <div className="pixel-board">
                  <i />
                  <i />
                  <i />
                  <b />
                  <span>
                    {evidence
                      ? t(`${evidence} CLUES PINNED`, `УЛИК ПРИКРЕПЛЕНО: ${evidence}`)
                      : t("FOLLOW THE DETAILS", "ИЩИТЕ ДЕТАЛИ")}
                  </span>
                </div>
              )}
              {item.id === "monitor" && (
                <div className="pixel-monitor">
                  <div className="monitor-screen">
                    <span>{t("RCA / ARCHIVE v1.0", "БЮРО / АРХИВ v1.0")}</span>
                    <strong>
                      {t("SEARCH", "ПОИСК")}
                      <br />
                      {t("THE ARCHIVE", "В АРХИВЕ")}<span className="cursor">_</span>
                    </strong>
                    <small>{t("One detail changes everything.", "Одна деталь меняет всё.")}</small>
                  </div>
                  <i />
                  <div className="monitor-neck" />
                  <div className="monitor-base" />
                </div>
              )}
              {item.id === "phone" && (
                <div className="pixel-phone">
                  <Icon name="phone" size={30} />
                  <span>{t("INFORMANT", "ИНФОРМАТОР")}</span>
                </div>
              )}
              {item.id === "cabinet" && (
                <div className="pixel-cabinet">
                  <i />
                  <i />
                  <span>{t("CASE ARCHIVE", "АРХИВ ДЕЛ")}</span>
                </div>
              )}
              {item.id === "safe" && (
                <div className="pixel-safe">
                  <span />
                  <i />
                  <b />
                </div>
              )}
              {item.id.startsWith("coffee_") && (
                <div className="pixel-coffees">
                  {[Number(item.id.slice(-1)) - 1].map((i) => (
                    <span key={i} className={i >= lives ? "empty" : ""}>
                      <i />
                      <b />
                    </span>
                  ))}
                </div>
              )}
              {item.id === "folder" && (
                <div className="pixel-folder">
                  <span className="folder-tab" />
                  <div className="folder-sheets" />
                  <div className="folder-cover">
                    <small>{t("RCA • INVESTIGATIONS", "БЮРО • РАССЛЕДОВАНИЯ")}</small>
                    <strong>{t("CASE FILE", "МАТЕРИАЛЫ ДЕЛА")}</strong>
                    <span>{t("CONFIDENTIAL", "КОНФИДЕНЦИАЛЬНО")}</span>
                  </div>
                </div>
              )}
              {item.id === "stamps" && (
                <div className="pixel-stamps">
                  <i>
                    <span />
                  </i>
                  <b>
                    <span />
                  </b>
                  <strong>{t("VERDICT", "ВЕРДИКТ")}</strong>
                </div>
              )}
            </>
          );
          const liveDetails = (
            <>
              {item.id === "calendar" && (
                <span className="calendar-live-date" style={{
                  left: `${spriteMeta.calendar.page.x / item.w * 100}%`,
                  top: `${spriteMeta.calendar.page.y / item.h * 100}%`,
                  width: `${spriteMeta.calendar.page.w / item.w * 100}%`,
                  height: `${spriteMeta.calendar.page.h / item.h * 100}%`,
                }}>
                  <span className="calendar-month">{monthLabel}</span>
                  <span className="calendar-day">{date.split("/")[1]?.replace(/^0/, "")}</span>
                </span>
              )}
              {item.id === "clock" && availableAssets.has("/assets/scene/clock.png") && (
                <span className="clock-live-hands" aria-hidden="true">
                  {[{ length: 0.65, angle: -90 + elapsed / 120 },
                    { length: 1, angle: -90 + elapsed / 10 }].map((hand, i) => (
                    <i key={i} style={{
                      left: `${spriteMeta.clock.cx / item.w * 100}%`,
                      top: `${spriteMeta.clock.cy / item.h * 100}%`,
                      width: `${spriteMeta.clock.handMax * hand.length / item.w * 100}%`,
                      transform: `rotate(${hand.angle}deg)`,
                    }} />
                  ))}
                </span>
              )}
            </>
          );
          if (hero)
            return (
              <div
                className={`scene-object object-${item.id} ${item.id === highlight ? "guided-object" : ""}`}
                style={style}
                key={item.id}
              >
                <Asset
                  key={sprite}
                  src={sprite}
                >
                  {fallback}
                </Asset>
                {liveDetails}
              </div>
            );
          return (
            <button
              className={`scene-object object-${item.id} ${item.id === highlight ? "guided-object" : ""}`}
              style={style}
              key={item.id}
              onClick={() =>
                onAction?.(
                  (item.id.startsWith("coffee_")
                    ? "coffee"
                    : item.id) as DeskAction,
                )
              }
              aria-label={
                item.id === "monitor"
                  ? t("Search the archive", "Поиск в архиве")
                  : item.id === "folder"
                    ? t("Open case folder", "Открыть материалы дела")
                    : item.id === "stamps"
                      ? t("Make your verdict", "Вынести вердикт")
                      : label
              }
            >
              <Asset
                key={sprite}
                src={sprite}
              >
                {fallback}
              </Asset>
              {item.id === "safe" && activeObject === "safe" && (
                <span className="safe-cash-label">${balance.toFixed(0)}</span>
              )}
              {item.id === "monitor" && (
                <span className="monitor-live-label" style={{
                  left: `${spriteMeta.monitor.screen.x / item.w * 100}%`,
                  top: `${spriteMeta.monitor.screen.y / item.h * 100}%`,
                  width: `${spriteMeta.monitor.screen.w / item.w * 100}%`,
                  height: `${spriteMeta.monitor.screen.h / item.h * 100}%`,
                }}>
                  {t("RCA / ARCHIVE", "БЮРО / АРХИВ")}
                  <br />
                  <b>
                    {t("SEARCH RECORDS", "ПОИСК ЗАПИСЕЙ")}<span className="cursor">_</span>
                  </b>
                </span>
              )}
              {liveDetails}
              {item.id === "board" && evidence > 0 && (
                <span className="board-live-notes" aria-hidden="true">
                  {Array.from({ length: Math.min(evidence, 4) }, (_, i) => (
                    <i key={i}>
                      <b />
                      {t("EXHIBIT", "УЛИКА")} {String.fromCharCode(65 + i)}
                    </i>
                  ))}
                </span>
              )}
              <span className="hotspot-dot" aria-hidden="true" />
              <span className="object-label">
                {label}
                {item.id === "clock" ? ` · ${formatTime(elapsed)}` : ""}
                <Icon name="arrow" size={12} />
              </span>
            </button>
          );
        })}
        <div className="scene-vignette" />
      </div>
    </div>
  );
}

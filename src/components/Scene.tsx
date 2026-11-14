import { useState, type CSSProperties, type ReactNode } from "react";
import layout from "../scene/layout.json";
import { Icon } from "./Icons";
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
}: {
  onAction?: (action: DeskAction) => void;
  elapsed?: number;
  lives?: number;
  evidence?: number;
  balance?: number;
  hero?: boolean;
  date?: string;
}) {
  return (
    <div className={`scene-shell ${hero ? "scene-hero" : ""}`}>
      <div
        className="scene"
        aria-label={hero ? "A cozy detective office" : "Detective desk"}
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
        <div className="scene-lamp">
          <i />
          <b />
          <span />
        </div>
        <div className="desk-mat" />
        <div className="desk-pen" />
        <div className="office-plaque">
          RIVERTON
          <br />
          <strong>CONSUMER AFFAIRS</strong>
        </div>
        {layout.objects.map((item) => {
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
                  <span>NOV</span>
                  <strong>{date.split("/")[1] || "14"}</strong>
                  <small>SATURDAY</small>
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
                      ? `${evidence} CLUES PINNED`
                      : "FOLLOW THE DETAILS"}
                  </span>
                </div>
              )}
              {item.id === "monitor" && (
                <div className="pixel-monitor">
                  <div className="monitor-screen">
                    <span>RCA / ARCHIVE v1.0</span>
                    <strong>
                      SEARCH
                      <br />
                      THE ARCHIVE<span className="cursor">_</span>
                    </strong>
                    <small>One detail changes everything.</small>
                  </div>
                  <i />
                  <div className="monitor-neck" />
                  <div className="monitor-base" />
                </div>
              )}
              {item.id === "phone" && (
                <div className="pixel-phone">
                  <Icon name="phone" size={30} />
                  <span>INFORMANT</span>
                </div>
              )}
              {item.id === "cabinet" && (
                <div className="pixel-cabinet">
                  <i />
                  <i />
                  <span>CASE ARCHIVE</span>
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
                    <small>RCA • INVESTIGATIONS</small>
                    <strong>CASE FILE</strong>
                    <span>CONFIDENTIAL</span>
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
                  <strong>VERDICT</strong>
                </div>
              )}
            </>
          );
          if (hero)
            return (
              <div
                className={`scene-object object-${item.id}`}
                style={style}
                key={item.id}
              >
                <Asset
                  src={`/assets/${item.id.startsWith("coffee_") && Number(item.id.slice(-1)) > lives ? "scene/coffee_empty.png" : item.id === "safe" && balance > 0 ? "scene/safe_open.png" : item.sprite}`}
                >
                  {fallback}
                </Asset>
              </div>
            );
          return (
            <button
              className={`scene-object object-${item.id}`}
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
                  ? "Search the archive"
                  : item.id === "folder"
                    ? "Open case folder"
                    : item.id === "stamps"
                      ? "Make your verdict"
                      : item.label
              }
            >
              <Asset
                src={`/assets/${item.id.startsWith("coffee_") && Number(item.id.slice(-1)) > lives ? "scene/coffee_empty.png" : item.id === "safe" && balance > 0 ? "scene/safe_open.png" : item.sprite}`}
              >
                {fallback}
              </Asset>
              {item.id === "safe" && (
                <span className="safe-cash-label">${balance.toFixed(0)}</span>
              )}
              {item.id === "monitor" && (
                <span className="monitor-live-label">
                  RCA / ARCHIVE
                  <br />
                  <b>
                    SEARCH RECORDS<span className="cursor">_</span>
                  </b>
                </span>
              )}
              {item.id === "calendar" && (
                <span className="calendar-live-date">{date.split("/")[1]}</span>
              )}
              <span className="object-label">
                {item.label}
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

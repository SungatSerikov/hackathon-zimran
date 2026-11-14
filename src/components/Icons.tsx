import type { CSSProperties } from "react";

const paths: Record<string, string> = {
  folder: "M2 5h7l2 3h11v13H2V5zm2 5v9h16v-9H4z",
  search:
    "M10 2a8 8 0 1 0 4.9 14.3L21 22l2-2-6.1-5.7A8 8 0 0 0 10 2zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10z",
  pin: "M7 2h10v3h-2v6l4 3v2h-6v6h-2v-6H5v-2l4-3V5H7V2z",
  file: "M5 2h10l5 5v15H5V2zm9 2v5h4v11H7V4h7zm-5 8h7v2H9v-2zm0 4h7v2H9v-2z",
  arrow: "M3 11h13l-5-5 2-2 9 8-9 8-2-2 5-5H3v-2z",
  back: "M21 11H8l5-5-2-2-9 8 9 8 2-2-5-5h13v-2z",
  lock: "M7 10V6a5 5 0 0 1 10 0v4h3v12H4V10h3zm3 0h4V6a2 2 0 0 0-4 0v4zm1 4v4h2v-4h-2z",
  check: "M2 12l3-3 5 5L20 4l3 3-13 13-8-8z",
  close: "M5 3l7 7 7-7 2 2-7 7 7 7-2 2-7-7-7 7-2-2 7-7-7-7 2-2z",
  coffee:
    "M3 6h14v2h5v8h-5v2l-3 3H6l-3-3V6zm14 5v3h2v-3h-2zM5 1h2v3H5V1zm5 0h2v3h-2V1z",
  stamp: "M8 2h8v6l-2 3v4h6l2 6H2l2-6h6v-4L8 8V2z",
  clock: "M4 2h16v3h2v14h-2v3H4v-3H2V5h2V2zm1 3v14h14V5H5zm6 2h2v5h4v2h-6V7z",
  star: "M10 1h4v7h8v4h-4v8h-4v-4h-4v4H6v-8H2V8h8V1z",
  trophy:
    "M6 2h12v3h5v8h-5l-4 4v3h4v3H6v-3h4v-3l-4-4H1V5h5V2zm12 6v2h2V8h-2zM4 8v2h2V8H4z",
  people: "M4 3h6v7H4V3zm10 0h6v7h-6V3zM1 13h12v9H1v-9zm14 0h8v9h-8v-9z",
  sound: "M2 9h5l6-6v18l-6-6H2V9zm14-3h2v3h3v6h-3v3h-2v-3h2V9h-2V6z",
  help: "M7 2h10v3h3v7h-6v4h-3V9h6V5H7v4H4V5h3V2zm4 17h3v3h-3v-3z",
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={style}
      fill="currentColor"
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}

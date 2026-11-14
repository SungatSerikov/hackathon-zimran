// Общий код для tools/*.mjs: PNG-кодировщик, единая палитра P, класс Canvas. Без зависимостей.
import { deflateSync } from 'node:zlib';

// ---------- PNG ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
export function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bit, RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Палитра ----------
export const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];
// Приглушённая «чистая офисная» палитра (32 цвета, лимит 32): тёплые светло-серые, беж, мягкий уголь,
// орех, серебро/белая техника, приглушённый зелёный акцент. Контуры — тёмные тонированные (ink/edge/rimDk), не чёрные.
export const P = Object.fromEntries(Object.entries({
  ink: '#26323a', wall: '#cfc9be', desk: '#7a5640', deskDk: '#664634', deskLt: '#8e664c',
  edge: '#4a3a32', beigeDk: '#b4ab9a', screenOn: '#6fb59a',
  paper: '#ece6d6', paperDk: '#d0c9b6', folder: '#c9a766',  white: '#f5f3ee',
  red: '#b5584c', green: '#5f8a6a', cork: '#b08f68', corkDk: '#957650', steel: '#a3a9ae', steelDk: '#7d848a',
  mug: '#e4e1d8', coffee: '#4a3228', gold: '#c9a850', blue: '#6a88a8',
  // добавлено для tools/draw-sprites.mjs (blue*/red* — корешки папок)
  blueDk: '#4e6a88', blueLt: '#8fa8c2', redDk: '#8a4038', redLt: '#cc7466',
  rimDk: '#45464d', greenDk: '#46684f', greenLt: '#86ab8e', folderLt: '#dcc28c', mugDk: '#bcb9b0', glint: '#ffffff',
}).map(([k, v]) => [k, hex(v)]));
// Отдельная палитра портретов (tools/draw-portraits.mjs): ТОЛЬКО 4 новых оттенка кожи. Тени выстроены цепочкой:
// тень тона N = база тона N+1 (fair -> light -> med -> brown -> P.desk), а два самых тёмных тона берутся из P
// (deep = P.deskDk / тень P.coffee). Всё остальное (волосы, одежда, фон, контуры) тоже из P. Итого в игре 32 + 4 = 36 цветов.
// Основная палитра P не менялась, поэтому уже нарисованные спрайты сцены остались прежними.
export const PP = Object.fromEntries(Object.entries({
  skinFair: '#e8c4a6', skinLight: '#dcb088', skinMed: '#c28d62', skinBrown: '#a06c48',
}).map(([k, v]) => [k, hex(v)]));
export const CLEAR = [0, 0, 0, 0];

// ---------- Холст ----------
export class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.d = Buffer.alloc(w * h * 4); }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d.set(c, (y * this.w + x) * 4);
  }
  alpha(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  rect(x, y, w, h, c) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  circle(cx, cy, r, c) { this.ellipse(cx, cy, r, r, c); }
  ellipse(cx, cy, rx, ry, c) {
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++)
      if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1.0) this.set(cx + i, cy + j, c);
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  // 1px контур по внутренней границе непрозрачной области (размер спрайта не меняется)
  outline(c = P.ink) {
    const edge = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++)
      if (this.alpha(x, y) && !(this.alpha(x - 1, y) && this.alpha(x + 1, y) && this.alpha(x, y - 1) && this.alpha(x, y + 1))) edge.push([x, y]);
    for (const [x, y] of edge) this.set(x, y, c);
  }
  png() { return encodePng(this.w, this.h, this.d); }
}

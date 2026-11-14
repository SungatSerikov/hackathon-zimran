// Генератор пиксельных заглушек. Без зависимостей. Существующие файлы не трогает (кроме --force).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');
const FORCE = process.argv.includes('--force');

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
function encodePng(w, h, rgba) {
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
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];
const P = Object.fromEntries(Object.entries({
  ink: '#1e1a2b', wall: '#7a6a8a', wallDk: '#6a5a7a', desk: '#8a5a3c', deskDk: '#774b31', deskLt: '#9c6a48',
  edge: '#5a3a28', beige: '#c8b89a', beigeDk: '#a89878', screen: '#223a3a', screenOn: '#3fd08a',
  paper: '#efe6cc', paperDk: '#d4c8a8', folder: '#d9a441', folderDk: '#b8832c', white: '#f4f0e6',
  red: '#c8453c', green: '#4caf50', cork: '#b88a5a', corkDk: '#9a7048', steel: '#8a94a0', steelDk: '#6a7480',
  mug: '#e8e0d0', coffee: '#5a3420', gold: '#e8c84a', blue: '#4a7ab8',
}).map(([k, v]) => [k, hex(v)]));
const CLEAR = [0, 0, 0, 0];

// ---------- Холст ----------
class Canvas {
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
const make = (w, h, fn, outline = true) => { const c = new Canvas(w, h); fn(c, w, h); if (outline) c.outline(); return c; };

// ---------- Рисовалки ----------
const monitor = (on) => (w, h) => make(w, h, (c) => {
  c.rect(0, 0, w, h - 22, P.beige);
  c.rect(w - 14, h - 32, 6, 3, P.green); // led
  c.rect(10, 8, w - 20, h - 42, P.ink);
  c.rect(12, 10, w - 24, h - 46, on ? P.screenOn : P.screen);
  if (on) for (let y = 16; y < h - 38; y += 8) c.rect(18, y, w - 50 - (y % 16) * 2, 2, P.screen);
  c.rect(w / 2 - 20, h - 24, 40, 8, P.beigeDk); // шея
  c.rect(w / 2 - 36, h - 16, 72, 16, P.beige); // подставка
  c.rect(w / 2 - 36, h - 6, 72, 6, P.beigeDk);
});
const folder = (open) => (w, h) => make(w, h, (c) => {
  if (!open) {
    c.rect(0, 8, w, h - 8, P.folder);
    c.rect(0, 0, 50, 12, P.folder); // язычок
    c.rect(2, h - 12, w - 4, 8, P.folderDk);
    c.rect(w / 2 - 16, 30, 32, 14, P.paper); // этикетка
    c.rect(w / 2 - 12, 35, 24, 2, P.ink);
  } else {
    c.rect(0, 10, w, h - 10, P.folderDk);
    c.rect(0, 0, 50, 14, P.folderDk);
    c.rect(8, 4, w - 16, h - 14, P.paper);
    for (let y = 12; y < h - 28; y += 8) c.rect(14, y, w - 28 - (y % 16), 2, P.paperDk);
    c.rect(0, h - 26, w, 26, P.folder);
    c.rect(2, h - 12, w - 4, 8, P.folderDk);
  }
});
const clock = (w, h) => make(w, h, (c) => {
  const cx = w / 2 - 1, cy = h / 2 - 1, r = w / 2 - 1;
  c.circle(cx, cy, r, P.ink);
  c.circle(cx, cy, r - 2, P.white);
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) c.rect(cx + dx * (r - 5), cy + dy * (r - 5), 2, 2, P.ink);
  c.line(cx, cy, cx, cy - 9, P.ink);
  c.line(cx, cy, cx + 6, cy + 2, P.red);
  c.rect(cx - 1, cy - 1, 3, 3, P.ink);
});
const calendar = (w, h) => make(w, h, (c) => {
  c.rect(0, 0, w, h, P.white);
  c.rect(0, 0, w, 14, P.red);
  c.rect(10, 3, 3, 3, P.ink); c.rect(w - 13, 3, 3, 3, P.ink);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) c.rect(6 + i * 9, 22 + j * 9, 5, 5, P.paperDk);
});
const coffee = (empty) => (w, h) => make(w, h, (c) => {
  c.rect(0, 4, w - 6, h - 4, P.mug);
  c.rect(w - 8, 9, 8, 14, P.mug); // ручка
  c.rect(w - 5, 12, 2, 8, CLEAR);
  c.rect(2, 6, w - 10, 5, empty ? P.paperDk : P.coffee);
  c.rect(2, h - 5, w - 10, 3, P.paperDk);
  if (!empty) c.rect(4, 7, 6, 1, P.deskLt);
});
const stamps = (w, h) => make(w, h, (c) => {
  c.rect(0, h - 22, w, 22, P.steel); // лоток
  c.rect(0, h - 22, w, 4, P.steelDk);
  for (const [x, col] of [[10, P.green], [w - 46, P.red]]) {
    c.rect(x + 12, 0, 12, 14, P.ink); // ручка
    c.rect(x + 14, 2, 8, 10, col);
    c.rect(x + 8, 14, 20, 6, col); // основание
    c.rect(x + 4, 20, 28, 12, P.corkDk);
  }
  c.rect(0, h - 10, w, 10, P.steel);
});
const stampImg = (col, n) => (w, h) => make(w, h, (c) => {
  c.rect(0, 0, w, h, col);
  c.rect(4, 4, w - 8, h - 8, CLEAR);
  const bw = Math.floor((w - 20) / n);
  for (let i = 0; i < n; i++) c.rect(10 + i * bw, 14, bw - 3, h - 28, col);
}, false);
const paper = (w, h) => {
  const c = new Canvas(w, h);
  c.rect(0, 0, w, h, P.paper);
  for (let i = 0; i < 40; i++) c.rect((i * 29) % w, (i * 47) % h, 2, 1, P.paperDk);
  return c;
};
const safe = (open) => (w, h) => make(w, h, (c) => {
  c.rect(0, 0, w, h, P.steel);
  c.rect(0, h - 6, w, 6, P.steelDk);
  if (!open) {
    c.rect(6, 6, w - 12, h - 18, P.steelDk);
    c.circle(w / 2, h / 2 - 3, 12, P.steel);
    c.circle(w / 2, h / 2 - 3, 4, P.ink);
    c.rect(w / 2 - 1, h / 2 - 15, 2, 6, P.gold);
  } else {
    c.rect(6, 6, w - 12, h - 18, P.ink);
    c.rect(10, 22, w - 20, 22, P.paper); // содержимое
    c.rect(w - 16, 6, 10, h - 18, P.steelDk); // дверца
  }
});
const board = (w, h) => make(w, h, (c) => {
  c.rect(0, 0, w, h, P.steelDk);
  c.rect(4, 4, w - 8, h - 8, P.cork);
  for (let i = 0; i < 60; i++) c.rect(6 + ((i * 37) % (w - 14)), 6 + ((i * 23) % (h - 14)), 2, 1, P.corkDk);
});
const sticker = (w, h) => make(w, h, (c) => { c.rect(0, 0, w, h, P.gold); c.rect(3, 6, w - 6, 2, P.ink); c.rect(3, 10, w - 10, 2, P.ink); });
const logo = (w, h) => make(w, h, (c) => {
  c.rect(0, 0, w, h, P.ink);
  c.rect(3, 3, w - 6, h - 6, P.wall);
  for (let i = 0; i < 9; i++) c.rect(14 + i * 19, 18, 14, 24, P.gold);
});
const bg = (dim) => (w, h) => {
  const c = new Canvas(w, h);
  const wall = dim ? P.wallDk : P.wall, wall2 = dim ? hex('#5a4a6a') : P.wallDk;
  const desk = dim ? P.deskDk : P.desk, desk2 = dim ? hex('#66402a') : P.deskDk;
  c.rect(0, 0, w, 108, wall);
  for (let x = 0; x < w; x += 24) c.rect(x, 0, 2, 108, wall2); // полосы обоев
  c.rect(0, 100, w, 8, wall2);
  c.rect(0, 108, w, 4, P.edge);
  c.rect(0, 112, w, h - 112, desk);
  for (let y = 120, r = 0; y < h; y += 14, r++) {
    c.rect(0, y, w, 2, desk2); // доски
    for (let x = (r % 2) * 40; x < w; x += 80) c.rect(x, y, 2, 14, desk2);
  }
  return c;
};
const portrait = (col) => (w, h) => make(w, h, (c) => {
  c.ellipse(w / 2, h - 4, 18, 14, col); // плечи
  c.rect(w / 2 - 4, 26, 8, 8, P.beigeDk); // шея
  c.ellipse(w / 2, 18, 9, 11, P.beige); // голова
  c.ellipse(w / 2, 11, 10, 6, col); // волосы
  c.outline(); // контур силуэта
  // фон-плашка позади силуэта, после контура
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!c.alpha(x, y)) c.set(x, y, P.wallDk);
}, false);

// ---------- Список ----------
const files = [
  ['scene/bg.png', () => bg(false)(480, 270)],
  ['scene/monitor.png', () => monitor(false)(150, 120)],
  ['scene/monitor_on.png', () => monitor(true)(150, 120)],
  ['scene/folder.png', () => folder(false)(140, 80)],
  ['scene/folder_open.png', () => folder(true)(140, 80)],
  ['scene/clock.png', () => clock(36, 36)],
  ['scene/calendar.png', () => calendar(44, 52)],
  ['scene/coffee.png', () => coffee(false)(24, 28)],
  ['scene/coffee_empty.png', () => coffee(true)(24, 28)],
  ['scene/stamps.png', () => stamps(110, 55)],
  ['ui/stamp_approved.png', () => stampImg(P.green, 8)(96, 40)],
  ['ui/stamp_denied.png', () => stampImg(P.red, 6)(96, 40)],
  ['ui/paper.png', () => paper(64, 64)],
  ['scene/safe.png', () => safe(false)(70, 60)],
  ['scene/safe_open.png', () => safe(true)(70, 60)],
  ['scene/board.png', () => board(150, 80)],
  ['ui/sticker_new.png', () => sticker(16, 16)],
  ['ui/logo.png', () => logo(200, 60)],
  ['ui/menu_bg.png', () => bg(true)(480, 270)],
];
const portraitColors = {
  linda_park: '#4a7ab8', dale_hughes: '#8a8a8a', tina_ruiz: '#c8453c', marcus_bell: '#4caf50',
  priya_shah: '#9a5ab8', gloria_mendez: '#e8c84a', kyle_denton: '#d9803c', ray_ortiz: '#3aa8a8',
};
for (const [id, col] of Object.entries(portraitColors)) files.push([`portraits/${id}.png`, () => portrait(hex(col))(48, 48)]);

const created = [], skipped = [];
for (const [rel, build] of files) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, build().png(), { flag: FORCE ? 'w' : 'wx' });
    created.push(rel);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    skipped.push(rel);
  }
}
console.log(`Создано (${created.length}):\n` + created.map((f) => '  + ' + f).join('\n'));
console.log(`Пропущено, уже существуют (${skipped.length})` + (skipped.length ? ' (--force для перезаписи):\n' + skipped.map((f) => '  = ' + f).join('\n') : ''));

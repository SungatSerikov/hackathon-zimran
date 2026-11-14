// Рисует вручную (попиксельно) спрайты и фон: часы, календарь, кружки, сейф, телефон, полку с папками, bg. Без зависимостей.
// ВСЕГДА перезаписывает scene/clock, calendar, coffee, coffee_empty, safe, safe_open, phone, phone_ring, cabinet, bg (.png)
// и src/scene/sprite-meta.json. Стиль: приглушённая чистая палитра, тёмные тонированные контуры; свет справа-сверху, мягкий.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P, Canvas } from './lib/pixel.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCENE = join(ROOT, 'public', 'assets', 'scene');

const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const fillEll = (c, cx, cy, rx, ry, col) => {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (inEll(x, y, cx, cy, rx, ry)) c.set(x, y, col);
};

// ---------- Часы 36x36 ----------
// Центр оси — пиксель (17,17); это на пол-пикселя левее/выше геометрического центра холста 36x36 (17.5,17.5):
// круг диаметром 35 занимает пиксели 0..34, колонка/строка 35 прозрачны. Код рисует стрелки от (17,17).
const CLOCK = { cx: 17, cy: 17, handMax: 11 };
function drawClock() {
  const c = new Canvas(36, 36);
  const { cx, cy } = CLOCK;
  for (let y = 0; y < 36; y++) for (let x = 0; x < 36; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > 17.5) continue;
    const t = d ? (dx * 0.85 - dy * 0.55) / d : 0; // >0: сторона к свету (справа-сверху)
    if (d > 16.5) { c.set(x, y, P.rimDk); continue; } // тёмный угольный контур
    if (d > 14.5) { c.set(x, y, t > 0.35 ? P.white : t < -0.35 ? P.steelDk : P.steel); continue; } // тонкий светло-серый обод
    if (d > 13.5) { c.set(x, y, t > 0 ? P.paperDk : P.steelDk); continue; } // фаска под стекло
    c.set(x, y, d > 12.2 && t < -0.3 ? P.paperDk : P.paper); // циферблат + мягкая тень от обода слева
  }
  // 12/3/6/9: явные координаты (симметрично относительно оси): линия 5 px + поперечная насечка на внешнем конце
  const major = [
    [[17, 5], [17, 6], [17, 7], [17, 8], [17, 9], [16, 5], [18, 5]], // 12
    [[17, 29], [17, 28], [17, 27], [17, 26], [17, 25], [16, 29], [18, 29]], // 6
    [[29, 17], [28, 17], [27, 17], [26, 17], [25, 17], [29, 16], [29, 18]], // 3
    [[5, 17], [6, 17], [7, 17], [8, 17], [9, 17], [5, 16], [5, 18]], // 9
  ];
  for (const t of major) for (const [x, y] of t) c.set(x, y, P.rimDk);
  for (let k = 0; k < 12; k++) {
    if (k % 3 === 0) continue;
    const ang = (k * Math.PI) / 6;
    for (const r of [10.8, 11.8]) c.set(Math.round(cx + Math.sin(ang) * r), Math.round(cy - Math.cos(ang) * r), P.steelDk);
  }
  // блик на стекле: короткая диагональ, не касается рисок (проверено отдельным скриптом при разработке)
  for (const [x, y] of [[23, 11], [24, 10], [25, 9]]) c.set(x, y, P.glint);
  // ось
  c.rect(cx - 1, cy - 1, 3, 3, P.rimDk);
  c.set(cx + 1, cy - 1, P.steel);
  return c;
}

// ---------- Календарь 44x52 ----------
const CAL = { x: 4, y: 21, w: 36, h: 22 }; // пустая страница, один цвет P.white
function drawCalendar() {
  const W = 44, H = 52;
  const c = new Canvas(W, H);
  // картонная петля над шапкой (x=19..24); кольца переплёта в стороне от неё (x=5..13 и x=30..38)
  c.rect(19, 0, 6, 8, P.cork);
  c.rect(19, 0, 1, 8, P.corkDk);
  c.rect(21, 2, 2, 2, P.deskLt); // отверстие под гвоздь (тёмная ниша)
  c.rect(21, 2, 2, 1, P.steelDk);
  c.rect(22, 3, 1, 1, P.steel); // шляпка гвоздя
  // блок страниц
  c.rect(0, 15, W, 37, P.white);
  c.rect(1, 15, 1, 29, P.paperDk); // тень у левого края
  // толщина стопки внизу: чередующиеся края страниц на всю ширину
  for (let y = 44; y <= 49; y++) c.rect(1, y, W - 2, 1, (y - 44) % 2 ? P.white : P.paperDk);
  c.rect(1, 50, W - 2, 1, P.mugDk);
  // шапка (приглушённый зелёный): слева темнее, справа светлее
  c.rect(0, 6, W, 9, P.green);
  c.rect(0, 6, 5, 9, P.greenDk);
  c.rect(W - 5, 6, 4, 7, P.greenLt);
  c.rect(0, 13, W, 2, P.greenDk);
  // переплёт: кольца
  for (const x of [5, 11, 30, 36]) { // зеркально относительно центра: 5<->36, 11<->30
    c.rect(x, 4, 3, 6, P.steel);
    c.rect(x, 4, 1, 6, P.steelDk);
    c.set(x + 1, 5, P.glint);
    c.rect(x, 11, 3, 1, P.rimDk); // дырка под кольцом
  }
  // остатки оторванных листов: рваный белый край с тенью
  c.rect(1, 15, W - 2, 1, P.paperDk); // тень шапки
  const teeth = [2, 3, 3, 2, 1, 1, 2, 3, 2, 1, 2, 2, 3, 3, 2, 1, 1, 2, 3, 3, 2, 2, 1, 1, 2, 3, 2, 1, 2, 2, 3, 3, 2, 1, 1, 2, 3, 2, 1, 2, 2, 3];
  for (let x = 1; x < W - 1; x++) {
    const h = teeth[x - 1];
    for (let j = 0; j < h; j++) c.set(x, 16 + j, P.paper); // остаток листа (тоном темнее страницы)
    c.set(x, 16 + h, P.paperDk); // тень рваного края на странице ниже
  }
  // подвёрнутые уголки
  for (const x of [12, 30]) {
    c.rect(x, 16, 4, 3, P.paper);
    c.rect(x, 19, 4, 1, P.paperDk);
    c.rect(x + 3, 16, 1, 3, P.mugDk);
    c.rect(x + 2, 18, 2, 1, P.mugDk);
  }
  // чистая страница (перекрывает всё лишнее)
  c.rect(CAL.x, CAL.y, CAL.w, CAL.h, P.white);
  c.outline(P.rimDk);
  return c;
}

// ---------- Кружка 24x28 (кружка стоит внизу холста; одна и та же позиция у полной и пустой) ----------
function drawMug(full) {
  const c = new Canvas(24, 28);
  const CX = 9.5;
  for (let y = 11; y < 27; y++) for (let x = 3; x <= 16; x++) {
    const body = inEll(x, y, CX, 14, 7, 3) || (y >= 14 && y <= 22) || inEll(x, y, CX, 22, 7, 3.4);
    if (!body) continue;
    c.set(x, y, x <= 5 ? P.mugDk : x >= 13 && x <= 15 ? P.white : P.mug);
  }
  // ручка (справа, ближе к свету)
  for (let y = 13; y < 25; y++) for (let x = 17; x < 24; x++) {
    if (!inEll(x, y, 16.5, 18, 6, 4.8) || inEll(x, y, 16.5, 18, 3.3, 2.2)) continue;
    c.set(x, y, y >= 21 ? P.mugDk : x >= 20 || y <= 14 ? P.white : P.mug);
  }
  // ободок
  fillEll(c, CX, 14, 7, 3, P.white);
  for (let x = 3; x <= 8; x++) for (let y = 11; y <= 17; y++) if (inEll(x, y, CX, 14, 7, 3)) c.set(x, y, P.mug);
  if (full) {
    fillEll(c, CX, 14, 5.5, 2, P.mugDk); // внутренняя стенка кружки
    for (let y = 14; y <= 15; y++) for (let x = 4; x <= 15; x++) if (inEll(x, y, CX, 14.8, 5.2, 1.6)) c.set(x, y, P.coffee);
    c.set(11, 14, P.coffeeLt); c.set(12, 14, P.glint); c.set(8, 15, P.coffeeLt); // кофе ниже края: сверху виден ряд керамики
  } else {
    fillEll(c, CX, 14, 5.5, 2, P.edge);
    for (let x = 6; x <= 13; x++) c.set(x, 13, P.rimDk);
    for (let x = 6; x <= 13; x++) c.set(x, 15, P.coffeeLt); // след от кофе на дне (светлее тёмной стенки)
    c.set(5, 14, P.coffeeLt); c.set(14, 14, P.coffeeLt);
  }
  c.outline(P.edge); // тёмно-коричневый контур вместо чёрного
  // мягкая тень на столе (свет справа -> тень влево)
  for (let y = 25; y < 28; y++) for (let x = 0; x < 24; x++)
    if (!c.alpha(x, y) && inEll(x, y, 8, 26, 9.5, 1.7)) c.set(x, y, P.deskDk);
  if (full) { // три завитка пара: сверху вниз, верх бледнее
    const wisps = [
      [[6, 2], [6, 3], [7, 4], [7, 5], [8, 6], [8, 7], [7, 8], [7, 9]],
      [[10, 0], [10, 1], [9, 2], [9, 3], [10, 4], [10, 5], [11, 6], [11, 7], [10, 8], [10, 9]],
      [[13, 3], [13, 4], [14, 5], [14, 6], [13, 7], [13, 8], [13, 9]],
    ];
    for (const w of wisps) w.forEach(([x, y], i) => c.set(x, y, i < 2 ? P.beigeDk : P.white));
  }
  return c;
}

// ---------- общие помощники ----------
// Корешок/пачка: контур edge, заливка mid, левая колонка темнее, правая светлее (свет справа).
const shadedBox = (c, x, y, w, h, { lit, mid, dk, edge = P.edge }) => {
  c.rect(x, y, w, h, edge);
  c.rect(x + 1, y + 1, w - 2, h - 2, mid);
  c.rect(x + 1, y + 1, 1, h - 2, dk);
  c.rect(x + w - 2, y + 1, 1, h - 2, lit);
  c.rect(x + 1, y + 1, w - 2, 1, lit);
};
const blit = (dst, src, ox, oy) => {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const i = (y * src.w + x) * 4;
    if (src.d[i + 3]) dst.set(ox + x, oy + y, [src.d[i], src.d[i + 1], src.d[i + 2], 255]);
  }
};

// ---------- Сейф 70x60 ----------
// Корпус x=8..67 (слева место под распахнутую дверцу), панель дверцы x=12..63. Одна посадка у closed/open.
const SAFE = { bx: 8, by: 1, bw: 60, bh: 54, px: 12, py: 5, pw: 52, ph: 46 };
function bundle(c, x, y, w, h) {
  shadedBox(c, x, y, w, h, { lit: P.greenLt, mid: P.green, dk: P.greenDk, edge: P.greenDk });
  c.rect(x + ((w - 3) >> 1), y, 3, h, P.paper); // бумажная лента
  c.rect(x + ((w - 3) >> 1), y + h - 1, 3, 1, P.paperDk);
}
function drawSafe(open) {
  const c = new Canvas(70, 60);
  const { bx, by, bw, bh, px, py, pw, ph } = SAFE;
  // корпус: стальная рамка, справа светлее
  c.rect(bx, by, bw, bh, P.steelDk);
  c.rect(bx, by, 1, bh, P.rimDk);
  c.rect(bx + bw - 3, by + 1, 2, bh - 2, P.steel);
  c.rect(bx + 1, by, bw - 2, 1, P.steel);
  c.rect(bx, by + bh - 2, bw, 2, P.rimDk);
  for (const fx of [bx + 4, bx + bw - 12]) { // ножки
    c.rect(fx, by + bh, 8, 4, P.steelDk);
    c.rect(fx, by + bh, 1, 4, P.rimDk);
    c.rect(fx + 7, by + bh, 1, 4, P.steel);
  }
  if (!open) {
    c.rect(px - 1, py - 1, pw + 2, ph + 2, P.rimDk);
    c.rect(px, py, pw, ph, P.green); // дверца: приглушённо-зелёная краска
    c.rect(px, py, 2, ph, P.greenDk);
    c.rect(px + pw - 2, py, 2, ph, P.greenLt);
    c.rect(px, py, pw, 1, P.greenLt);
    c.rect(px, py + ph - 2, pw, 2, P.greenDk);
    for (const [rx, ry] of [[px + 4, py + 4], [px + pw - 6, py + 4], [px + 4, py + ph - 6], [px + pw - 6, py + ph - 6]]) {
      c.set(rx, ry, P.greenDk); c.set(rx + 1, ry - 1, P.greenLt); // заклёпки
    }
    const dx = 33, dy = 27; // диск набора
    for (let y = dy - 12; y <= dy + 12; y++) for (let x = dx - 12; x <= dx + 12; x++) {
      const d = Math.hypot(x - dx, y - dy);
      if (d > 11.5) continue;
      const t = d ? ((x - dx) * 0.85 - (y - dy) * 0.55) / d : 0;
      if (d > 10.5) c.set(x, y, P.rimDk);
      else if (d > 8.2) c.set(x, y, t > 0.35 ? P.white : t < -0.35 ? P.steelDk : P.steel);
      else c.set(x, y, d > 7.2 ? P.rimDk : P.ink);
    }
    for (let k = 0; k < 12; k++) { // шкала
      const a = (k * Math.PI) / 6;
      c.set(Math.round(dx + Math.sin(a) * 5.6), Math.round(dy - Math.cos(a) * 5.6), k % 3 ? P.steelDk : P.white);
    }
    c.rect(dx - 1, dy - 1, 3, 3, P.steel); c.set(dx + 1, dy - 1, P.white); // ступица
    c.rect(dx - 1, dy - 14, 3, 2, P.gold); // метка
    c.rect(51, 14, 6, 26, P.rimDk); // рукоять справа
    c.rect(52, 15, 4, 24, P.steel);
    c.rect(52, 15, 1, 24, P.steelDk);
    c.rect(55, 15, 1, 24, P.white);
    c.rect(49, 24, 3, 6, P.rimDk); c.rect(50, 25, 1, 4, P.steelDk);
    for (const hy of [10, 38]) { // петли слева, выступают за корпус
      c.rect(bx - 3, hy, 4, 9, P.rimDk);
      c.rect(bx - 2, hy + 1, 2, 7, P.steelDk);
      c.set(bx - 2, hy + 2, P.steel);
    }
  } else {
    c.rect(px - 1, py - 1, pw + 2, ph + 2, P.rimDk);
    c.rect(px, py, pw, ph, P.ink); // тёмная ниша, тень сверху и слева
    c.rect(px + 2, py + 3, pw - 2, ph - 3, P.rimDk);
    c.rect(px + pw - 3, py + 3, 2, ph - 3, P.steelDk); // отсвет справа
    c.rect(px + 2, py + 22, pw - 2, 2, P.steelDk); // полка
    c.rect(px + 2, py + 22, pw - 2, 1, P.steel);
    for (const x of [14, 30, 46]) bundle(c, x, 42, 15, 8);
    for (const x of [22, 38]) bundle(c, x, 34, 15, 8);
    bundle(c, 17, 20, 15, 7);
    bundle(c, 36, 20, 15, 7);
    bundle(c, 36, 13, 15, 7);
    // распахнутая дверца: видна кромка, развёрнутая к зрителю
    c.rect(0, 2, 9, 54, P.rimDk);
    c.rect(1, 3, 7, 52, P.green);
    c.rect(1, 3, 2, 52, P.greenDk);
    c.rect(6, 3, 2, 52, P.greenLt);
    c.rect(1, 3, 7, 1, P.greenLt);
    for (const hy of [10, 38]) { c.rect(7, hy, 3, 9, P.rimDk); c.rect(8, hy + 1, 1, 7, P.steelDk); }
  }
  c.outline(P.rimDk);
  return c;
}

// ---------- Телефон 56x40 ----------
function drawPhone(ring) {
  const c = new Canvas(56, 40);
  const hy = ring ? 0 : 2; // на звонке трубка приподнята
  for (let y = 16; y <= 37; y++) { // основание-трапеция, верх светлее
    const inset = Math.max(0, Math.round((22 - y) / 3));
    const x0 = 2 + inset, x1 = 53 - inset;
    for (let x = x0; x <= x1; x++) {
      let col = P.mug;
      if (x <= x0 + 2) col = P.mugDk;
      else if (x >= x1 - 3) col = P.white;
      if (y <= 18) col = P.white;
      if (y >= 35) col = P.mugDk;
      c.set(x, y, col);
    }
  }
  c.rect(19, 20, 17, 14, P.steelDk); // клавиатура 3x4
  c.rect(19, 20, 17, 1, P.rimDk);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) {
    const bx = 20 + q * 5, by = 21 + r * 3;
    c.rect(bx, by, 4, 2, P.white);
    c.rect(bx, by + 1, 4, 1, P.paperDk);
  }
  c.rect(9, 24, 3, 3, ring ? P.gold : P.greenDk); // индикатор
  c.set(11, 24, ring ? P.glint : P.green);
  for (let i = 0; i < 3; i++) c.rect(42, 22 + i * 3, 7, 1, P.mugDk); // динамик
  c.rect(10, 13, 6, 4, P.mugDk); // рычаги вилки
  c.rect(40, 13, 6, 4, P.mugDk);
  c.rect(14, hy + 4, 28, 5, P.mug); // перемычка трубки
  c.rect(14, hy + 4, 28, 1, P.white);
  c.rect(14, hy + 8, 28, 1, P.mugDk);
  for (const x0 of [6, 40]) { // раструбы
    c.rect(x0, hy + 2, 11, 10, P.mug);
    c.rect(x0, hy + 2, 11, 2, P.white);
    c.rect(x0, hy + 10, 11, 2, P.mugDk);
    c.rect(x0, hy + 2, 2, 10, P.mugDk);
    c.rect(x0 + 9, hy + 3, 2, 8, P.white);
  }
  for (let y = hy + 12; y < 28; y++) { // спиральный шнур к основанию
    const x = 3 + (Math.floor((y - hy) / 2) % 2 ? 1 : 3);
    c.set(x, y, P.steelDk); c.set(x + 1, y, P.rimDk);
  }
  c.outline(P.edge);
  if (ring) for (const [x, y] of [[1, 3], [0, 6], [1, 9], [54, 3], [55, 6], [54, 9]]) c.set(x, y, P.paperDk); // вибрация
  return c;
}

// ---------- Настенная полка с архивными папками 110x40 ----------
function drawCabinet() {
  const c = new Canvas(110, 40);
  const SH = 34; // верх полки
  const ramps = {
    green: { lit: P.greenLt, mid: P.green, dk: P.greenDk },
    beige: { lit: P.paper, mid: P.paperDk, dk: P.beigeDk },
    blue: { lit: P.blueLt, mid: P.blue, dk: P.blueDk },
    red: { lit: P.redLt, mid: P.red, dk: P.redDk },
    wood: { lit: P.deskLt, mid: P.desk, dk: P.deskDk },
    steel: { lit: P.white, mid: P.steel, dk: P.steelDk },
  };
  const spines = [
    ['green', 9, 29], ['beige', 7, 26], ['red', 10, 31, true], ['blue', 8, 27], ['wood', 9, 30], ['steel', 7, 25],
    ['green', 10, 32, true], ['beige', 8, 28], ['blue', 9, 31], ['red', 7, 26], ['wood', 10, 29], ['green', 9, 30], ['steel', 8, 27], ['beige', 9, 30],
  ];
  let x = 2;
  for (const [key, w, h, lock] of spines) {
    const top = SH - h, r = ramps[key];
    shadedBox(c, x, top, w, h, r);
    c.rect(x + 1, top + 3, w - 2, 1, r.dk); // перетяжки корешка
    c.rect(x + 1, SH - 4, w - 2, 1, r.dk);
    c.rect(x + 2, top + 6, w - 4, 7, P.paper); // ярлык без текста
    c.rect(x + 2, top + 12, w - 4, 1, P.paperDk);
    if (lock) { // навесной замок (премиум)
      const x0 = x + ((w - 5) >> 1), y0 = top + 17;
      c.rect(x0 - 1, y0 - 1, 7, 6, P.rimDk);
      c.rect(x0, y0, 5, 4, P.gold);
      c.rect(x0, y0, 1, 4, P.corkDk);
      c.set(x0 + 4, y0, P.glint);
      c.set(x0 + 2, y0 + 1, P.rimDk);
      for (const [sx, sy] of [[1, -1], [1, -2], [2, -3], [3, -2], [3, -1]]) c.set(x0 + sx, y0 + sy, sx === 3 ? P.steel : P.steelDk);
    }
    x += w - 1;
  }
  c.rect(0, SH, 110, 6, P.desk); // полка
  c.rect(0, SH, 110, 1, P.deskLt);
  c.rect(0, SH + 4, 110, 2, P.deskDk);
  c.rect(0, SH, 2, 6, P.deskDk);
  c.rect(108, SH, 2, 6, P.deskLt);
  c.outline(P.edge);
  return c;
}

// ---------- Фон сцены 480x270 (без предметов; стена до y=107, стол с y=108) ----------
function leaf(c, x0, y0, x1, y1, w) { // лист-«капля» вдоль отрезка; справа светлее, слева темнее
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  for (let y = Math.min(y0, y1) - w; y <= Math.max(y0, y1) + w; y++) for (let x = Math.min(x0, x1) - w; x <= Math.max(x0, x1) + w; x++) {
    const rx = x - x0, ry = y - y0, t = (rx * ux + ry * uy) / L;
    if (t < 0 || t > 1) continue;
    const s = rx * -uy + ry * ux; // знак: сторона листа
    const half = w * Math.sin(Math.PI * t);
    if (Math.abs(s) > half) continue;
    const sr = ux >= 0 ? s : -s; // нормализуем так, чтобы «светлая» сторона смотрела вправо
    c.set(x, y, Math.abs(s) < 0.5 ? P.greenDk : sr * (uy >= 0 ? 1 : -1) < -0.25 * half ? P.greenLt : sr * (uy >= 0 ? 1 : -1) > 0.35 * half ? P.greenDk : P.green);
  }
}
function drawPlant() {
  const c = new Canvas(46, 64);
  const bx = 23, by = 42;
  for (const [tx, ty, w] of [[23, 3, 5], [12, 8, 5], [34, 8, 5], [5, 22, 5], [41, 22, 5], [8, 36, 4], [38, 36, 4], [17, 17, 4], [29, 17, 4]])
    leaf(c, bx, by, tx, ty, w);
  c.outline(P.greenDk);
  // горшок (контур edge)
  const rows = [];
  for (let y = 40; y <= 62; y++) {
    const inset = y < 46 ? 0 : Math.round((y - 46) / 3.2);
    rows.push([y, 6 + inset, 39 - inset]);
  }
  for (const [y, x0, x1] of rows) {
    for (let x = x0; x <= x1; x++) {
      let col = y < 46 ? P.paper : P.paperDk;
      if (x <= x0 + 3) col = y < 46 ? P.paperDk : P.beigeDk;
      else if (x >= x1 - 4 && y >= 46) col = P.paper;
      c.set(x, y, col);
    }
    c.set(x0, y, P.edge); c.set(x1, y, P.edge);
  }
  for (let x = 6; x <= 39; x++) { c.set(x, 40, P.edge); c.set(x, 46, P.beigeDk); }
  for (let x = rows[rows.length - 1][1]; x <= rows[rows.length - 1][2]; x++) c.set(x, 62, P.edge);
  for (let x = 8; x <= 37; x++) c.set(x, 41, P.coffee); // земля
  return c;
}
function drawBackground() {
  const W = 480, H = 270;
  const c = new Canvas(W, H);
  // --- стена ---
  c.rect(0, 0, W, 108, P.wall);
  c.rect(0, 70, W, 1, P.paperDk); // молдинг-«рейка»: светлая грань сверху, тень снизу
  c.rect(0, 71, W, 1, P.beigeDk);
  for (let x = 0; x < W; x += 80) c.rect(x, 72, 1, 26, P.paperDk); // панели под рейкой: тонкие швы
  for (let x = 0; x < W; x += 80) c.rect(x + 1, 72, 1, 26, P.beigeDk);
  c.rect(0, 98, W, 2, P.paperDk); // плинтус
  c.rect(0, 100, W, 8, P.beigeDk);
  c.rect(0, 100, W, 1, P.white);
  // --- окно над монитором (x=150..300, y=6..34) ---
  const wx = 150, wy = 6, ww = 150, wh = 28;
  c.rect(wx - 3, wy - 3, ww + 6, wh + 6, P.white);
  c.rect(wx - 3, wy - 3, 2, wh + 6, P.paperDk);
  c.rect(wx - 3, wy + wh + 2, ww + 6, 1, P.beigeDk);
  c.rect(wx, wy, ww, wh, P.blueLt);
  c.rect(wx, wy, ww, 8, P.blueLt);
  const skyline = [[0, 9], [10, 14], [22, 8], [34, 17], [50, 11], [62, 15], [78, 9], [92, 18], [108, 12], [122, 10], [134, 16]];
  skyline.forEach(([sx, sh], i) => {
    const nx = i + 1 < skyline.length ? skyline[i + 1][0] : ww;
    c.rect(wx + sx, wy + wh - sh, nx - sx, sh, P.blue);
    c.rect(wx + sx, wy + wh - sh, 1, sh, P.blueDk);
  });
  c.rect(wx, wy + wh - 3, ww, 3, P.blueDk);
  for (const mx of [wx + 49, wx + 99]) c.rect(mx, wy - 1, 2, wh + 2, P.white); // переплёты
  c.rect(wx + ww - 6, wy, 6, wh, P.paper); // блик от света справа
  c.rect(wx - 5, wy + wh + 3, ww + 10, 2, P.white); // подоконник
  c.rect(wx - 5, wy + wh + 5, ww + 10, 1, P.beigeDk);
  // --- кромка стола ---
  c.rect(0, 108, W, 1, P.deskLt);
  c.rect(0, 109, W, 2, P.desk);
  c.rect(0, 111, W, 1, P.deskDk); // тень под кромкой
  // --- столешница: доски (орех) ---
  c.rect(0, 112, W, H - 112, P.desk);
  for (let y = 112, r = 0; y < H; y += 16, r++) {
    c.rect(0, y, W, 1, P.deskDk);
    c.rect(0, y + 1, W, 1, P.deskLt);
    const off = (r % 2) * 56;
    for (let x = off; x < W; x += 112) { c.rect(x, y + 1, 1, 15, P.deskDk); }
    // прожилки: по две на доску, фиксированные длины и позиции (не шум)
    const gx = [(r * 37 + 14) % 160, (r * 53 + 210) % 330 + 120];
    c.rect(gx[0], y + 5, 26, 1, P.deskDk);
    c.rect(gx[0] + 6, y + 10, 18, 1, P.deskLt);
    c.rect(gx[1], y + 8, 32, 1, P.deskDk);
    c.rect(gx[1] + 10, y + 12, 14, 1, P.deskLt);
  }
  // --- растение справа от монитора (стоит на столе) ---
  for (let y = 172; y <= 176; y++) for (let x = 300; x < 372; x++) {
    if (inEll(x, y, 338, 175, 30, 3.2)) c.set(x, y, P.deskDk); // тень слева-вниз от света справа
  }
  blit(c, drawPlant(), 322, 114);
  return c;
}

// ---------- Запись ----------
const META = {
  clock: { cx: CLOCK.cx, cy: CLOCK.cy, handMax: CLOCK.handMax },
  calendar: { page: { ...CAL } },
};
const targets = [
  ['clock.png', drawClock()],
  ['calendar.png', drawCalendar()],
  ['coffee.png', drawMug(true)],
  ['coffee_empty.png', drawMug(false)],
  ['safe.png', drawSafe(false)],
  ['safe_open.png', drawSafe(true)],
  ['phone.png', drawPhone(false)],
  ['phone_ring.png', drawPhone(true)],
  ['cabinet.png', drawCabinet()],
  ['bg.png', drawBackground()],
];
export { targets };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(SCENE, { recursive: true });
  for (const [name, canvas] of targets) {
    writeFileSync(join(SCENE, name), canvas.png());
    console.log(`  * scene/${name} (${canvas.w}x${canvas.h})`);
  }
  const metaPath = join(ROOT, 'src', 'scene', 'sprite-meta.json');
  mkdirSync(dirname(metaPath), { recursive: true });
  writeFileSync(metaPath, JSON.stringify(META) + '\n');
  console.log('  * src/scene/sprite-meta.json');
}

// Рисует вручную (попиксельно) все спрайты сцены и фон: часы, календарь, кружки, сейф, телефон, полку, монитор,
// папку, доску, штампы, bg и оттиски ui/stamp_guilty|stamp_not_guilty и бланк ui/claim_form. Без зависимостей.
// ВСЕГДА перезаписывает все свои PNG (список — массив targets внизу) и src/scene/sprite-meta.json.
// Стиль: приглушённая чистая палитра, тёмные тонированные контуры; свет справа-сверху, мягкий.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P, Canvas } from './lib/pixel.mjs';
import { glyph, textWidth } from './lib/font.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'public', 'assets');

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
    c.set(11, 14, P.deskLt); c.set(12, 14, P.glint); c.set(8, 15, P.deskLt); // кофе ниже края: сверху виден ряд керамики
  } else {
    fillEll(c, CX, 14, 5.5, 2, P.edge);
    for (let x = 6; x <= 13; x++) c.set(x, 13, P.rimDk);
    for (let x = 6; x <= 13; x++) c.set(x, 15, P.deskLt); // след от кофе на дне (светлее тёмной стенки)
    c.set(5, 14, P.deskLt); c.set(14, 14, P.deskLt);
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
  c.rect(bx + 1, by + 1, bw - 2, 1, P.steel); // светлая грань (ряд by затирается контуром)
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

// ---------- Телефон 56x40: классический офисный кнопочный аппарат (тёмный клиновидный корпус, трубка «косточкой») ----------
function drawPhone(ring) {
  const c = new Canvas(56, 40);
  const edgeX = (y) => [Math.round(8 - ((y - 15) * 6) / 21), Math.round(47 + ((y - 15) * 6) / 21)]; // клин: сзади уже, спереди шире
  // корпус
  for (let y = 15; y <= 36; y++) {
    const [x0, x1] = edgeX(y);
    for (let x = x0; x <= x1; x++) {
      let col;
      if (y <= 17) col = y === 15 || x >= x1 - 6 ? P.steel : P.steelDk; // плоская верхняя грань
      else if (y === 18) col = P.ink; // шов
      else if (y <= 32) col = x <= x0 + 1 ? P.ink : P.rimDk; // наклонная панель с клавиатурой
      else col = P.rimDk; // передняя грань
      c.set(x, y, col);
    }
  }
  c.rect(edgeX(32)[0] + 2, 33, edgeX(33)[1] - edgeX(33)[0] - 3, 1, P.ink); // шов панель/перед
  // вилка под трубку (два выступа)
  for (const px of [10, 41]) {
    c.rect(px, 13, 5, 3, P.steelDk); // низкая вилка: на 2 px выше верхней грани
    c.rect(px, 13, 5, 1, P.steel);
    c.rect(px + 4, 13, 1, 3, P.steel);
  }
  // клавиатура 3x4: кнопки 4x2 с зазором 1
  c.rect(20, 19, 16, 13, P.ink);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) {
    const bx = 21 + q * 5, by = 20 + r * 3;
    c.rect(bx, by, 4, 1, P.paper);
    c.rect(bx, by + 1, 4, 1, P.paperDk);
  }
  // функциональные клавиши справа и слева внизу
  for (const [fx, fy] of [[39, 21], [43, 21], [39, 25], [43, 25]]) { c.rect(fx, fy, 3, 1, P.steel); c.rect(fx, fy + 1, 3, 1, P.steelDk); }
  for (const fx of [8, 12]) { c.rect(fx, 29, 3, 1, P.steel); c.rect(fx, 30, 3, 1, P.steelDk); }
  // пустой дисплей и светодиод
  c.rect(8, 20, 11, 4, P.steelDk);
  c.rect(9, 21, 9, 2, P.ink);
  if (ring) {
    c.set(9, 25, P.green); c.set(10, 25, P.green); c.set(8, 26, P.green); c.set(11, 26, P.green); c.set(8, 27, P.green); c.set(11, 27, P.green); c.set(9, 28, P.green); c.set(10, 28, P.green); // ореол
    c.rect(9, 26, 2, 2, P.greenLt);
    c.set(9, 26, P.glint);
  } else {
    c.rect(9, 26, 2, 2, P.greenDk);
    c.set(10, 26, P.green);
  }
  // трубка-«косточка»: раструбы шире перемычки, светлее корпуса. Покой: раструбы y=6..15 (сидят в вилке), перемычка y=11..14
  // касается верхней грани корпуса. Звонок: трубка снята (раструбы y=1..10),
  // между низом раструба и верхом вилки (y=13) остаются 2 прозрачные строки.
  const topL = ring ? 1 : 6, topR = topL;
  // спиральный шнур: непрерывная лента шириной 5 px (внутри диагональные витки), выходит из низа левого раструба
  // и уходит в боковину корпуса; в ring растягивается вместе с трубкой. Рисуется до контура, поэтому обводится им.
  for (let y = topL + 10; y <= 27; y++) for (let x = 1; x <= 5; x++) c.set(x, y, (x + y) % 4 < 2 ? P.steel : P.steelDk);
  c.rect(3, 26, 4, 3, P.ink); c.rect(4, 27, 2, 1, P.steelDk); // ввод шнура в корпус (гнездо)
  const piece = (x0, top) => {
    for (let j = 0; j < 10; j++) for (let i = 0; i < 12; i++) {
      if ((i === 0 || i === 11) && (j === 0 || j === 9)) continue; // скругление углов
      const col = j === 0 ? P.white : j >= 8 ? P.steelDk : i >= 10 ? P.white : i <= 1 ? P.steelDk : P.steel;
      c.set(x0 + i, top + j, col);
    }
    for (const dx of [3, 6, 9]) c.set(x0 + dx, top + 4, P.steelDk); // отверстия динамика/микрофона
  };
  piece(4, topL); piece(40, topR);
  for (let x = 16; x < 40; x++) { // перемычка толщиной 4 px
    const t = topL + 5;
    c.set(x, t, P.white);
    c.set(x, t + 1, P.steel); c.set(x, t + 2, P.steel);
    c.set(x, t + 3, P.steelDk);
  }
  c.outline(P.ink);
  // мягкая тень на столе под корпусом (свет справа -> тень уходит влево, заметно длиннее слева)
  for (let y = 36; y < 40; y++) for (let x = 0; x < 56; x++)
    if (!c.alpha(x, y) && inEll(x, y, 23, 37, 28, 2.6)) c.set(x, y, P.deskDk);
  // звонок: короткие дуги «(( ))» у раструбов на высоте поднятой трубки
  if (ring) {
    for (const [x, y] of [[2, 2], [1, 3], [1, 4], [2, 5], [0, 3], [0, 4], [53, 2], [54, 3], [54, 4], [53, 5], [55, 3], [55, 4]]) c.set(x, y, P.paper);
  }
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
// фиксированные смещения/длины прожилок [o1, l1, o2, l2] (px от начала куска доски)
const GRAIN = [[6, 28, 52, 22], [30, 20, 4, 30], [14, 34, 60, 18], [48, 24, 10, 26], [4, 22, 44, 30], [24, 30, 70, 16], [38, 26, 18, 24]];
function drawBackground(spr) {
  const W = 480, H = 270;
  const c = new Canvas(W, H);
  // --- стена ---
  c.rect(0, 0, W, 108, P.wall);
  c.rect(0, 63, W, 1, P.paperDk); // молдинг-«рейка» выше полки (y=66) и ниже календаря (до y=61)
  c.rect(0, 64, W, 1, P.beigeDk);
  for (let x = 0; x < W; x += 80) c.rect(x, 65, 1, 33, P.paperDk); // панели под рейкой: тонкие швы
  for (let x = 0; x < W; x += 80) c.rect(x + 1, 65, 1, 33, P.beigeDk);
  c.rect(0, 98, W, 2, P.paperDk); // плинтус
  c.rect(0, 100, W, 8, P.beigeDk);
  c.rect(0, 100, W, 1, P.white);
  // --- окно над монитором (x=150..300, y=6..32) ---
  const wx = 150, wy = 6, ww = 150, wh = 27; // низ подоконника (тень) на y=38; видимый контур монитора на y=42 (спрайт y=40, корпус со строки 2) => стена y=39..41, зазор 3 px
  c.rect(wx - 3, wy - 3, ww + 6, wh + 6, P.white);
  c.rect(wx - 3, wy - 3, 2, wh + 6, P.paperDk);
  c.rect(wx - 3, wy + wh + 2, ww + 6, 1, P.beigeDk);
  c.rect(wx, wy, ww, wh, P.blueLt);
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
  // --- стык стены и стола: чёткая линия и тень за столом у горизонта ---
  c.rect(0, 108, W, 1, P.edge);
  c.rect(0, 109, W, 3, P.deskDk);
  // --- столешница: одна цельная ореховая поверхность из трёх широких досок вдоль стола; дальний край темнее, ближний светлее ---
  const FAR_DARK_END = 124, MID_START = 145, NEAR_LIGHT = [218, 230, 239, 247, 254];
  const TRANS = [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1]; // 0 = deskDk, 1 = desk: строки-«дизеринг» между соседними цветами (без шахматки)
  for (let y = 112; y < 262; y++) {
    let col = P.desk;
    if (y <= FAR_DARK_END) col = P.deskDk;
    else if (y < MID_START) col = TRANS[y - FAR_DARK_END - 1] ? P.desk : P.deskDk;
    else if (NEAR_LIGHT.includes(y)) col = P.deskLt;
    c.rect(0, y, W, 1, col);
  }
  for (const sy of [166, 212]) { c.rect(0, sy, W, 1, P.deskDk); c.rect(0, sy + 1, W, 1, P.deskLt); } // стыки досок (сплошные, без смещений; первый ниже тени монитора)
  // длинные мягкие прожилки вдоль стола: фиксированная таблица [x, y, длина, 0 тёмная / 1 светлая]
  const GRAIN_LINES = [[20, 118, 90, 0], [200, 121, 140, 0], [380, 116, 80, 0], [60, 131, 150, 1], [260, 134, 110, 0], [400, 129, 70, 1],
    [10, 146, 120, 0], [170, 150, 95, 1], [300, 143, 160, 0], [90, 172, 130, 0], [250, 176, 100, 1], [390, 170, 85, 0], [30, 190, 60, 1],
    [150, 196, 150, 0], [330, 193, 120, 1], [5, 205, 100, 0], [220, 208, 90, 1], [360, 203, 110, 0], [70, 222, 140, 0], [250, 226, 80, 1],
    [380, 224, 95, 0], [20, 238, 110, 1], [160, 242, 120, 0], [300, 240, 150, 1], [100, 252, 90, 0], [260, 255, 130, 1], [400, 250, 60, 0]];
  for (const [gx, gy, len, light] of GRAIN_LINES) {
    const col = light ? (gy < 140 ? P.desk : P.deskLt) : P.deskDk;
    c.rect(gx, gy, Math.min(len, W - gx), 1, col);
  }
  // --- передняя кромка стола (толщина 6 px: блик сверху, тень снизу) и тёмная зона под столом ---
  c.rect(0, 261, W, 1, P.deskDk); // тонкая тень у лицевого края (скос столешницы)
  c.rect(0, 262, W, 2, P.deskLt);
  c.rect(0, 264, W, 2, P.desk);
  c.rect(0, 266, W, 2, P.deskDk);
  c.rect(0, 268, W, 1, P.edge);
  c.rect(0, 269, W, 1, P.ink);
  // --- контактные тени под предметами, стоящими на столе (кружки и телефон уже несут свою тень; растение рисуется ниже) ---
  const layout = JSON.parse(readFileSync(join(ROOT, 'src', 'scene', 'layout.json'), 'utf8'));
  // тень строится по «дну» спрайта: берутся только колонки, чьё дно в пределах 2 px от общего дна (петли, выступы и верх ножек не дают
  // висящих теней); отрезки колонок внутри mergeGap сливаются (сейф: тень под корпусом между ножками и под площадью открытой дверцы).
  const SHADOW_OPTS = { safe: { mergeGap: 60, extendLeft: 12 } };
  for (const o of layout.objects) {
    const sp = spr[o.id];
    if (!sp) continue;
    const opts = SHADOW_OPTS[o.id] ?? { mergeGap: 0, extendLeft: 0 };
    const bottoms = [];
    for (let x = 0; x < sp.w; x++) {
      let bottom = -1;
      for (let y = 0; y < sp.h; y++) if (sp.alpha(x, y)) bottom = y;
      bottoms.push(bottom);
    }
    const B = Math.max(...bottoms);
    const runs = [];
    bottoms.forEach((bt, x) => {
      if (bt < B - 2) return;
      const last = runs[runs.length - 1];
      if (last && x - last[1] <= opts.mergeGap + 1) last[1] = x; else runs.push([x, x]);
    });
    runs.forEach(([x0, x1], i) => {
      if (i === 0) x0 = Math.max(0, x0 - opts.extendLeft);
      for (let x = x0; x <= x1; x++) {
        const px = o.x + x - 2, y0 = o.y + B + 1; // тень смещена влево на 2 px (свет сверху-справа)
        c.set(px, y0, P.edge);
        c.set(px, y0 + 1, P.deskDk);
        if (x > x0 && x < x1) c.set(px, y0 + 2, P.deskDk); // третья строка короче на 1 px с концов, без пунктира
      }
    });
  }
  // --- растение справа от монитора (стоит на столе) ---
  for (let y = 172; y <= 176; y++) for (let x = 300; x < 372; x++) {
    if (inEll(x, y, 338, 175, 30, 3.2)) c.set(x, y, P.deskDk); // тень слева-вниз от света справа
  }
  blit(c, drawPlant(), 322, 114);
  return c;
}

// ---------- Монитор 150x120: ретро-ЭЛТ в 3/4 сверху (бежевый корпус с задней «колбой»), стекло, клавиатура ----------
// Чистая область под текст (однотонная, вся декорация экрана — только вне неё: рамка стекла, строка заголовка сверху, строка статуса снизу)
const MONITOR_SHIFT = 2; // верхняя часть рисуется со строки 0 и сдвигается на 2 px вниз: видимый контур корпуса на y=42 сцены, зазор до подоконника 3 px
const MONITOR_SCREEN0 = { x: 29, y: 28, w: 92, h: 48 }; // в координатах верхней части (до сдвига)
const MONITOR_SCREEN = { ...MONITOR_SCREEN0, y: MONITOR_SCREEN0.y + MONITOR_SHIFT };
// скруглённый прямоугольник: r — радиус угла в пикселях (срезаются угловые пиксели по окружности)
const rrr = (c, x, y, w, h, r, col) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cx = i < r ? r - 0.5 : i >= w - r ? w - r - 0.5 : i + 0.5;
    const cy = j < r ? r - 0.5 : j >= h - r ? h - r - 0.5 : j + 0.5;
    if (Math.hypot(i + 0.5 - cx, j + 0.5 - cy) > r - 0.2) continue;
    c.set(x + i, y + j, col);
  }
};
function drawMonitor(on) {
  const c = new Canvas(150, 120);
  // --- крыша корпуса: глубокая трапеция (y=0..10), сильно сужается к задней стенке (2.4 px за строку) ---
  const roofX = (y) => [14 + Math.round((10 - y) * 2.4), 135 - Math.round((10 - y) * 2.4)];
  for (let y = 0; y <= 10; y++) {
    const [x0, x1] = roofX(y);
    for (let x = x0; x <= x1; x++) c.set(x, y, y === 10 ? P.paperDk : y === 0 || x >= x1 - 5 ? P.white : x <= x0 + 4 ? P.paperDk : P.paper);
  }
  for (const y of [3, 5, 7]) { // вентиляционные прорези, длиннее к передней кромке
    const [x0, x1] = roofX(y);
    for (let x = x0 + 12; x + 3 <= x1 - 10; x += 5) c.rect(x, y, 3, 1, P.beigeDk);
  }
  // --- передняя панель x=14..135 (ширина = основание крыши): прямая сверху, скруглена снизу; торцы — полосы 3 px внутри силуэта ---
  c.rect(14, 11, 122, 70, P.paperDk);
  rrr(c, 14, 79, 122, 10, 4, P.paperDk);
  c.rect(14, 11, 122, 3, P.paper);
  c.rect(133, 14, 3, 66, P.paper);
  c.rect(14, 14, 3, 66, P.beigeDk);
  c.rect(16, 86, 118, 3, P.beigeDk);
  // --- утопленная фаска вокруг стекла: тень сверху/слева, свет снизу/справа ---
  rrr(c, 21, 18, 108, 63, 9, P.beigeDk);
  for (let y = 18; y < 81; y++) for (let x = 21; x < 129; x++) {
    if (c.alpha(x, y) && (y >= 79 || x >= 126)) c.set(x, y, y >= 80 || x >= 128 ? P.white : P.paper);
  }
  c.rect(17, 81, 116, 1, P.beigeDk); // перелом между рамкой и подбородком
  c.rect(17, 82, 116, 1, P.paper);
  rrr(c, 22, 19, 106, 61, 8, P.rimDk); // тёмный зазор между фаской и стеклом
  // --- выпуклое стекло (y=21..77) ---
  rrr(c, 24, 21, 102, 57, 8, on ? P.greenDk : P.ink);
  if (on) {
    rrr(c, 25, 22, 100, 55, 7, P.green); // виньетка: тёмная кромка и более тёмные углы
    rrr(c, 27, 24, 96, 51, 5, P.screenOn);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) {
      c.set(25 + i, 22 + j, P.greenDk); c.set(124 - i, 22 + j, P.greenDk); c.set(25 + i, 76 - j, P.greenDk); c.set(124 - i, 76 - j, P.greenDk);
    }
    for (let y = 24; y < 75; y += 2) { c.rect(26, y, 1, 1, P.green); c.rect(123, y, 1, 1, P.green); } // строки развёртки у боковых краёв
  } else {
    // светлая прерывистая кромка выпуклого стекла по периметру (только вне MONITOR_SCREEN0)
    for (let x = 32; x <= 118; x += 2) { c.set(x, 22, P.rimDk); c.set(x, 77, P.rimDk); }
    for (let y = 33; y <= 70; y += 2) c.set(25, y, P.rimDk);
    for (let y = 32; y <= 46; y++) c.set(123, y, P.rimDk); // изогнутый блик вдоль правого края
    for (let y = 47; y <= 56; y++) c.set(122, y, P.rimDk);
    for (let y = 57; y <= 60; y++) c.set(121, y, P.rimDk);
  }
  // блик на изгибе: дуга у правого верхнего угла и диагональные штрихи в верхней полосе
  const hl = on ? P.greenLt : P.rimDk;
  for (let a = -90; a <= 0; a += 9) {
    const px = Math.round(118 + 5.2 * Math.cos((a * Math.PI) / 180)), py = Math.round(28 + 5.2 * Math.sin((a * Math.PI) / 180));
    c.set(px, py, hl);
  }
  for (const [x, y] of [[96, 27], [97, 26], [98, 25], [99, 24], [100, 23], [101, 22], [91, 27], [92, 26], [93, 25], [94, 24], [95, 23]]) c.set(x, y, on ? P.greenLt : P.steelDk);
  if (!on) { c.rect(34, 24, 13, 1, P.rimDk); c.rect(34, 25, 7, 1, P.rimDk); } // отражение оконного света
  if (on) {
    c.rect(29, 23, 92, 4, P.greenDk); // строка заголовка окна (y=23..26) без текста
    c.rect(31, 24, 2, 2, P.greenLt); c.rect(35, 24, 2, 2, P.greenLt); c.rect(39, 24, 2, 2, P.greenLt);
    c.rect(52, 25, 40, 1, P.green);
    c.rect(116, 24, 3, 2, P.greenLt); // блок размером с курсор
    c.rect(29, 27, 92, 1, P.green);
    // мягкое свечение: светлые полосы по центру верхней и нижней кромки зазора стекла и по бокам
    c.rect(60, 19, 30, 1, P.greenLt); c.rect(60, 78, 30, 1, P.greenLt);
    c.rect(22, 40, 1, 20, P.greenLt); c.rect(127, 40, 1, 20, P.greenLt);
    for (let y = 32; y <= 44; y++) c.set(123, y, P.greenLt); // блик вдоль правого края
  }
  c.rect(MONITOR_SCREEN0.x, MONITOR_SCREEN0.y, MONITOR_SCREEN0.w, MONITOR_SCREEN0.h, on ? P.screenOn : P.ink); // чистая область
  // --- подбородок: бейдж без текста, решётка, ручки, кнопка питания, светодиод ---
  c.rect(24, 83, 26, 4, P.beigeDk);
  c.rect(25, 83, 24, 3, P.paper);
  c.rect(25, 85, 24, 1, P.paperDk);
  c.rect(27, 84, 8, 1, P.beigeDk); // декоративная полоска бейджа
  for (let x = 58; x <= 82; x += 4) c.rect(x, 83, 1, 3, P.beigeDk); // вентиляционная решётка
  for (const x of [90, 96]) { c.rect(x, 83, 4, 4, P.steelDk); c.rect(x + 1, 83, 2, 1, P.steel); c.rect(x + 3, 84, 1, 2, P.steel); } // ручки яркости/контраста
  c.rect(106, 83, 10, 4, P.steelDk); c.rect(106, 83, 10, 1, P.steel); c.rect(115, 84, 1, 3, P.steel); // кнопка питания
  c.rect(120, 84, 3, 2, on ? P.greenLt : P.steelDk);
  if (on) c.set(122, 84, P.glint);
  // --- шея и поворотная подставка ---
  c.rect(60, 89, 30, 4, P.beigeDk);
  c.rect(84, 89, 6, 4, P.paperDk);
  rrr(c, 44, 93, 62, 6, 2, P.paperDk);
  c.rect(46, 93, 58, 1, P.paper);
  c.rect(46, 98, 58, 1, P.beigeDk);
  c.rect(100, 94, 4, 4, P.paper);
  // --- сдвиг верхней части вниз и клавиатура в перспективе: сзади уже, спереди шире; видны толщина и колпачки клавиш ---
  const o = new Canvas(150, 120);
  blit(o, c, 0, MONITOR_SHIFT);
  for (let y = 102; y <= 118; y++) {
    const x0 = Math.round(24 - (y - 102) * 0.8), x1 = Math.round(125 + (y - 102) * 0.8);
    for (let x = x0; x <= x1; x++) o.set(x, y, y >= 116 ? P.beigeDk : y === 102 ? P.paper : x >= x1 - 2 ? P.paper : x <= x0 + 1 ? P.beigeDk : P.paperDk);
  }
  for (let r = 0; r < 4; r++) {
    const y = 103 + r * 3; // строка колпачков: 2 строки (светлая верхняя грань + тело) и 1 строка тени
    const x0 = Math.round(24 - (y - 102) * 0.8) + 3, x1 = Math.round(125 + (y - 102) * 0.8) - 3;
    const keyCap = (x, w, dark) => {
      o.rect(x, y, w, 1, dark ? P.paper : P.white);
      o.rect(x, y + 1, w, 1, dark ? P.paperDk : P.paper);
    };
    if (r < 3) {
      let k = 0;
      for (let x = x0; x + 3 <= x1; x += 5, k++) keyCap(x, 4, k === 0 || x + 8 > x1);
    } else { // нижний ряд: боковые клавиши и длинный тёмный пробел
      const mid0 = Math.round((x0 + x1) / 2) - 18;
      for (let x = x0; x + 3 < mid0 - 2; x += 5) keyCap(x, 4, false);
      o.rect(mid0, y, 36, 1, P.paperDk); o.rect(mid0, y + 1, 36, 2, P.beigeDk); // пробел: колпачок темнее остальных, верхняя кромка paperDk, тень снизу
      for (let x = mid0 + 40; x + 3 <= x1; x += 5) keyCap(x, 4, false);
    }
  }
  o.outline(P.edge);
  return o;
}

// ---------- Папка дела 140x80 ----------
const FOLDER_PAGES = [{ x: 11, y: 15, w: 52, h: 54 }, { x: 77, y: 15, w: 52, h: 54 }];
function drawFolder(open) {
  const c = new Canvas(140, 80);
  if (!open) {
    // листы выглядывают из-под задней стенки
    c.rect(80, 3, 56, 9, P.paperDk);
    c.rect(66, 5, 60, 8, P.paper);
    c.rect(66, 5, 60, 1, P.white);
    c.rect(66, 12, 60, 1, P.paperDk);
    c.rect(70, 8, 40, 1, P.paperDk);
    // задняя стенка и язычок
    c.rect(2, 10, 136, 5, P.cork);
    c.rect(6, 5, 52, 10, P.folder);
    c.rect(6, 5, 52, 1, P.folderLt);
    c.rect(6, 5, 1, 10, P.cork);
    // передняя обложка
    c.rect(2, 14, 136, 64, P.folder);
    c.rect(2, 14, 136, 1, P.folderLt);
    c.rect(135, 15, 3, 58, P.folderLt);
    c.rect(2, 15, 2, 58, P.cork);
    c.rect(2, 72, 136, 1, P.cork);
    c.rect(2, 73, 136, 5, P.corkDk);
    // пустой ярлык
    c.rect(11, 23, 48, 18, P.corkDk);
    c.rect(12, 24, 46, 16, P.paper);
    c.rect(12, 38, 46, 2, P.paperDk);
    // скрепка
    c.rect(112, 6, 8, 1, P.steel); c.rect(112, 27, 8, 1, P.steel);
    c.rect(112, 6, 1, 22, P.steelDk); c.rect(119, 6, 1, 22, P.white);
    c.rect(114, 10, 1, 14, P.steelDk); c.rect(117, 10, 1, 14, P.white);
    c.rect(114, 10, 4, 1, P.steel); c.rect(114, 23, 4, 1, P.steel);
  } else {
    c.rect(2, 8, 136, 70, P.folder);
    c.rect(6, 3, 52, 6, P.folder);
    c.rect(6, 3, 52, 1, P.folderLt);
    c.rect(6, 3, 1, 6, P.cork);
    c.rect(2, 8, 136, 1, P.folderLt);
    c.rect(135, 9, 3, 64, P.folderLt);
    c.rect(2, 9, 2, 64, P.cork);
    c.rect(2, 72, 136, 1, P.cork);
    c.rect(2, 73, 136, 5, P.corkDk);
    c.rect(68, 9, 4, 64, P.cork); // сгиб
    c.rect(69, 9, 2, 64, P.corkDk);
    c.rect(6, 14, 58, 60, P.paperDk); // нижние листы
    c.rect(76, 14, 58, 60, P.paperDk);
    c.rect(8, 12, 58, 60, P.paper); // левая страница (x=8..65)
    c.rect(74, 12, 58, 60, P.paper); // правая страница (x=74..131)
    c.rect(8, 12, 58, 1, P.white); c.rect(74, 12, 58, 1, P.white);
    c.rect(63, 13, 3, 59, P.paperDk); c.rect(74, 13, 3, 59, P.paperDk); // тень у сгиба
    c.rect(8, 70, 58, 2, P.paperDk); c.rect(74, 70, 58, 2, P.paperDk);
  }
  c.outline(P.edge);
  return c;
}

// ---------- Пробковая доска 150x80 ----------
const BOARD_AREA = { x: 6, y: 6, w: 138, h: 68 };
function drawBoard() {
  const c = new Canvas(150, 80);
  c.rect(0, 0, 150, 80, P.desk); // рама: сверху и справа светлее, слева и снизу темнее (углы без наложений)
  c.rect(0, 0, 150, 3, P.deskLt);
  c.rect(147, 3, 3, 74, P.deskLt);
  c.rect(0, 3, 3, 74, P.deskDk);
  c.rect(0, 77, 150, 3, P.deskDk);
  c.rect(4, 4, 142, 72, P.edge); // внутренняя кромка
  c.rect(5, 5, 140, 70, P.cork); // пробка
  c.rect(5, 5, 140, 1, P.corkDk); c.rect(5, 5, 1, 70, P.corkDk); // тень рамы сверху и слева
  // сдержанная фактура: крапинки по фиксированной таблице [x, y], равномерно по всему полю
  const SPECKS = [[34, 9], [62, 12], [88, 8], [112, 11], [132, 9], [20, 30], [46, 24], [74, 28], [104, 22], [134, 30], [14, 44],
    [38, 38], [58, 46], [82, 40], [98, 34], [122, 42], [140, 50], [26, 56], [50, 60], [70, 54], [92, 58], [110, 50], [18, 68],
    [42, 70], [66, 67], [88, 70], [104, 66], [8, 52], [78, 18], [56, 32], [30, 48], [116, 30], [138, 18], [96, 46], [64, 62],
    [24, 22], [100, 12], [44, 14], [136, 40], [12, 36], [128, 66], [76, 44]];
  SPECKS.forEach(([x, y], i) => {
    const col = i % 2 ? P.corkDk : P.folderLt;
    c.set(x, y, col);
    if (i % 3 === 0) c.set(x + 1, y, col);
  });
  // две пустые бумажки по углам с кнопками
  const scrap = (x, y, w, h, pinCol, pinLt) => {
    c.rect(x + 1, y + 1, w, h, P.corkDk);
    c.rect(x, y, w, h, P.paper);
    c.rect(x, y, w, 1, P.white);
    c.rect(x, y + h - 1, w, 1, P.paperDk);
    pin(x + (w >> 1), y + 1, pinCol, pinLt);
  };
  const pin = (x, y, col, lt) => {
    c.set(x, y + 1, P.corkDk); c.set(x + 1, y + 1, P.corkDk); // тень
    c.rect(x - 1, y - 1, 3, 3, col);
    c.set(x, y - 1, lt);
    c.set(x + 1, y + 1, P.edge);
  };
  scrap(10, 10, 18, 12, P.red, P.redLt);
  scrap(118, 56, 22, 13, P.blue, P.blueLt);
  pin(136, 12, P.green, P.greenLt);
  pin(12, 66, P.gold, P.glint);
  c.outline(P.edge);
  return c;
}

// ---------- Лоток со штампами 110x55 ----------
function drawStamps() {
  const c = new Canvas(110, 55);
  // --- деревянная стойка в 3/4 сверху: задняя стенка, дно, боковые торцы, передний борт ---
  c.rect(3, 24, 63, 2, P.deskLt); // верхняя грань задней стенки
  c.rect(3, 26, 63, 10, P.deskDk); // её внутренняя сторона (в тени)
  c.rect(58, 26, 8, 10, P.desk); // отсвет справа
  c.rect(3, 36, 63, 8, P.desk); // дно
  c.rect(3, 36, 63, 1, P.deskDk); // тень под стенкой
  c.rect(0, 24, 3, 28, P.deskDk); // левый торец
  c.rect(66, 24, 3, 28, P.deskLt); // правый торец (светлее)
  c.rect(0, 44, 69, 8, P.desk); // передний борт
  c.rect(0, 44, 69, 1, P.deskLt);
  c.rect(0, 50, 69, 2, P.deskDk);
  // --- штамп: точёная деревянная ручка-«гриб» с цветной меткой, латунная плита, тонкая резина ---
  const stamp = (cx, mark, markLt) => {
    c.rect(cx - 9, 27, 18, 8, P.deskLt); // колодка светлее стойки, блик справа и тёмный верх
    c.rect(cx - 9, 27, 3, 8, P.desk); c.rect(cx + 5, 27, 4, 8, P.cork); c.rect(cx - 9, 27, 18, 1, P.deskDk);
    c.rect(cx - 12, 35, 24, 3, P.gold); // латунная плита
    c.rect(cx - 12, 35, 24, 1, P.folderLt); c.rect(cx - 12, 37, 24, 1, P.corkDk);
    c.rect(cx - 11, 38, 22, 2, P.rimDk); // резина
    c.rect(cx - 6, 24, 12, 3, P.desk); c.rect(cx - 6, 24, 2, 3, P.deskDk); c.rect(cx + 4, 24, 2, 3, P.deskLt); // воротник
    c.rect(cx - 3, 14, 7, 10, P.desk); c.rect(cx - 3, 14, 2, 10, P.deskDk); c.rect(cx + 2, 14, 2, 10, P.deskLt); // шейка
    c.rect(cx - 4, 18, 9, 2, P.gold); c.rect(cx - 4, 18, 9, 1, P.folderLt); // латунное кольцо
    [12, 15, 17, 18, 18, 17, 15, 12, 9, 7].forEach((w, i) => { // выпуклая шляпка: наибольшая ширина на трети высоты, плавно в шейку
      const y = 4 + i, x0 = cx - (w >> 1);
      c.rect(x0, y, w, 1, P.desk);
      c.rect(x0, y, 3, 1, P.deskDk); c.rect(x0 + w - 4, y, 4, 1, P.deskLt);
    });
    for (let y = 1; y <= 6; y++) for (let x = cx - 8; x <= cx + 8; x++) { // верхняя грань: эллипс с цветной меткой
      if (inEll(x, y, cx, 3.6, 6.5, 2.3)) c.set(x, y, inEll(x, y, cx, 3.6, 3.8, 1.2) ? mark : P.deskLt);
    }
    c.set(cx + 1, 3, markLt);
  };
  stamp(20, P.red, P.redLt); // GUILTY: красная метка
  stamp(48, P.green, P.greenLt); // NOT GUILTY: зелёная метка
  // --- низкая жестянка (синяя эмаль, латунный кант): сверху виден тёмный войлок, крышка откинута назад короткой трапецией ---
  for (let y = 34; y <= 39; y++) { // крышка (изнанка, потёртая латунь), наклонена назад
    const inset = 40 - y; // скос заканчивается на линии контура корпуса (на y=39 — со срезанным углом, как у ободка)
    c.rect(74 + inset, y, 30 - 2 * inset, 1, y === 34 ? P.folderLt : P.corkDk);
  }
  c.rect(84, 36, 10, 2, P.gold); // маленькая плашка на изнанке
  c.rect(84, 36, 10, 1, P.folderLt);
  const cutBox = (x, y, w, h, col) => { // прямоугольник со срезанными угловыми пикселями (полный, без пропавших рядов)
    c.rect(x, y, w, h, col);
    for (const [cx2, cy2] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) c.set(cx2, cy2, [0, 0, 0, 0]);
  };
  cutBox(74, 40, 30, 8, P.gold); // латунный ободок коробки: y=40..47, x=74..103 (та же ширина, что у стенки)
  c.rect(76, 40, 26, 1, P.folderLt);
  cutBox(76, 41, 26, 6, P.ink); // пропитанный войлок
  for (const [gx, gy] of [[76, 41], [101, 41], [76, 46], [101, 46]]) c.set(gx, gy, P.gold); // углы войлока — латунь, без дыр — главная видимая плоскость
  c.rect(80, 42, 8, 1, P.rimDk); c.rect(92, 44, 5, 1, P.rimDk); // влажные блики
  c.rect(74, 48, 30, 4, P.blueDk); // передняя стенка — тёмно-синяя эмаль
  c.rect(100, 49, 4, 3, P.blue); c.rect(74, 49, 3, 3, P.ink);
  c.outline(P.edge);
  return c;
}

// ---------- Оттиски штампов 120x40: GUILTY (красный) / NOT GUILTY (зелёный); единственное место с текстом ----------
// шрифт — общий: tools/lib/font.mjs (глифы GUILTY / NOT GUILTY не менять)
const STAMP_W = 120, STAMP_H = 40;
// оттиск: двойная рамка, строка бюро, крупное слово, наклон 2° (по пикселям, без сглаживания), неровная краска и «лысины» (детерминированно)
function drawStampImpression(word, ink, inkDk, inkLt, gap = 2) {
  const W = STAMP_W, H = STAMP_H;
  const TAN = Math.tan((2 * Math.PI) / 180), CX = (W - 1) / 2;
  const off = (x) => Math.round(-(x - CX) * TAN); // наклон 2°: правая сторона выше
  // рамки и разделитель рисуются прямо, затем каждая колонка сдвигается целиком (линии не рвутся)
  const u = new Canvas(W, H);
  u.rect(2, 3, W - 4, 2, ink); u.rect(2, H - 5, W - 4, 2, ink); u.rect(2, 3, 2, H - 6, ink); u.rect(W - 4, 3, 2, H - 6, ink);
  u.rect(6, 7, W - 12, 1, ink); u.rect(6, H - 8, W - 12, 1, ink); u.rect(6, 7, 1, H - 14, ink); u.rect(W - 7, 7, 1, H - 14, ink);
  u.rect(10, 17, W - 20, 1, ink);
  const c = new Canvas(W, H);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (u.alpha(x, y)) c.set(x, y + off(x), ink);
  // текст: каждый глиф целиком сдвигается на смещение своего центра (буквы не ломаются); слово «NOT GUILTY» — между словами 3 px
  const line = (text, y0, S, g, wordGap) => {
    const parts = text.split(' ');
    const wordsW = parts.map((p) => textWidth(p, S, g));
    const total = wordsW.reduce((a, b) => a + b, 0) + wordGap * (parts.length - 1);
    let x = Math.floor((W - total) / 2);
    parts.forEach((p, k) => {
      for (const ch of p) {
        const gl = glyph(ch), gw = gl[0].length * S, dy = off(x + (gw >> 1));
        gl.forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') c.rect(x + i * S, y0 + j * S + dy, S, S, ink); }));
        x += gw + g;
      }
      x += wordGap - g;
    });
  };
  line('COMPLAINTS BUREAU', 10, 1, 1, 4);
  line(word, 20, 2, gap, gap === 1 ? 5 : 6);
  // износ: потёртости у краёв, фиксированные «лысины» только у рамок и в полях (буквы читаемы), неравномерная плотность краски
  const bald = [[5, 12, 3], [114, 14, 3], [60, 34, 3], [113, 30, 3], [14, 33, 3]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!c.alpha(x, y)) continue;
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const edgeD = Math.min(x, y, W - 1 - x, H - 1 - y);
    let gone = h % 100 < (edgeD < 9 ? 9 : 1);
    for (const [bx, by, br] of bald) if (Math.hypot(x - bx, y - by) < br && (h >>> 3) % 100 < 70) gone = true;
    if (gone) { c.set(x, y, [0, 0, 0, 0]); continue; }
    if ((h >>> 7) % 100 < 10) c.set(x, y, inkDk);
    else if ((h >>> 11) % 100 < (x > 85 ? 20 : 11)) c.set(x, y, inkLt);
  }
  return c;
}

// ---------- Бланк жалобы 200x120 (без текста) ----------
const CLAIM_ROWS = [{ x: 14, y: 52, w: 172 }, { x: 14, y: 74, w: 172 }, { x: 14, y: 96, w: 172 }];
function drawClaimForm() {
  const c = new Canvas(200, 120);
  c.rect(0, 0, 200, 120, P.paper);
  c.rect(0, 0, 200, 1, P.white); c.rect(197, 1, 3, 118, P.white);
  c.rect(1, 1, 2, 118, P.paperDk); c.rect(0, 117, 200, 3, P.paperDk);
  // шапка бюро: зелёная полоса и эмблема-щит
  c.rect(8, 8, 184, 24, P.green);
  c.rect(8, 8, 3, 24, P.greenDk); c.rect(186, 8, 6, 24, P.greenLt); c.rect(8, 30, 184, 2, P.greenDk);
  c.rect(14, 11, 16, 18, P.paper);
  c.rect(16, 13, 12, 12, P.greenDk); c.rect(18, 25, 8, 2, P.greenDk); c.rect(20, 27, 4, 1, P.greenDk);
  c.rect(19, 16, 6, 6, P.paper); c.rect(21, 14, 2, 10, P.paper);
  c.rect(38, 14, 70, 3, P.greenLt); c.rect(38, 21, 46, 2, P.greenLt); // «строки» заголовка без текста
  // номер дела: пустая рамка справа
  c.rect(142, 38, 44, 7, P.paperDk); c.rect(143, 39, 42, 5, P.paper);
  // пустые строки: подчёркивания + метка-плашка слева над линией
  for (const r of CLAIM_ROWS) {
    c.rect(r.x, r.y, r.w, 1, P.beigeDk);
    c.rect(r.x, r.y + 1, r.w, 1, P.paperDk);
    c.rect(r.x, r.y - 8, 34, 4, P.paperDk); // место под подпись поля
  }
  c.rect(14, 110, 60, 1, P.beigeDk); // подпись
  c.outline(P.edge);
  return c;
}

// ---------- Запись ----------
const META = {
  clock: { cx: CLOCK.cx, cy: CLOCK.cy, handMax: CLOCK.handMax },
  calendar: { page: { ...CAL } },
  monitor: { screen: { ...MONITOR_SCREEN } },
  folder_open: { pages: FOLDER_PAGES.map((p) => ({ ...p })) },
  board: { area: { ...BOARD_AREA } },
  claim_form: { rows: CLAIM_ROWS.map((r) => ({ ...r })) },
};
const SPR = { monitor: drawMonitor(false), safe: drawSafe(false), folder: drawFolder(false), stamps: drawStamps() }; // для контактных теней в bg
const targets = [
  ['clock.png', drawClock()],
  ['calendar.png', drawCalendar()],
  ['coffee.png', drawMug(true)],
  ['coffee_empty.png', drawMug(false)],
  ['safe.png', SPR.safe],
  ['safe_open.png', drawSafe(true)],
  ['phone.png', drawPhone(false)],
  ['phone_ring.png', drawPhone(true)],
  ['cabinet.png', drawCabinet()],
  ['bg.png', drawBackground(SPR)],
  ['monitor.png', SPR.monitor],
  ['monitor_on.png', drawMonitor(true)],
  ['folder.png', SPR.folder],
  ['folder_open.png', drawFolder(true)],
  ['board.png', drawBoard()],
  ['stamps.png', SPR.stamps],
  ['ui/stamp_guilty.png', drawStampImpression('GUILTY', P.red, P.redDk, P.redLt)],
  ['ui/stamp_not_guilty.png', drawStampImpression('NOT GUILTY', P.green, P.greenDk, P.greenLt, 1)],
  ['ui/claim_form.png', drawClaimForm()],
];
export { targets };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [name, canvas] of targets) {
    const rel = name.includes('/') ? name : `scene/${name}`; // без папки — scene/
    mkdirSync(dirname(join(ASSETS, rel)), { recursive: true });
    writeFileSync(join(ASSETS, rel), canvas.png());
    console.log(`  * ${rel} (${canvas.w}x${canvas.h})`);
  }
  const metaPath = join(ROOT, 'src', 'scene', 'sprite-meta.json');
  mkdirSync(dirname(metaPath), { recursive: true });
  writeFileSync(metaPath, JSON.stringify(META) + '\n');
  console.log('  * src/scene/sprite-meta.json');
}

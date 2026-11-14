// Рисует вручную (попиксельно) все спрайты сцены и фон: часы, календарь, кружки, сейф, телефон, полку, монитор,
// папку, доску, штампы, bg и оттиски ui/stamp_guilty|stamp_not_guilty и бланк ui/claim_form. Без зависимостей.
// ВСЕГДА перезаписывает все свои PNG (список — массив targets внизу) и src/scene/sprite-meta.json.
// Стиль: приглушённая чистая палитра, тёмные тонированные контуры; свет справа-сверху, мягкий.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P, Canvas } from './lib/pixel.mjs';

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
function drawBackground() {
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
    for (let x = off; x < W; x += 112) c.rect(x, y + 1, 1, 15, P.deskDk); // стыки досок
    // прожилки: фиксированная таблица на кусок доски между стыками; не пересекают стыки, не выходят за x=479
    const xs = [off === 0 ? 0 : 0, ...Array.from({ length: 5 }, (_, k) => off + k * 112)].filter((x, i, arr) => x < W && arr.indexOf(x) === i).sort((p, q) => p - q);
    xs.forEach((x0, k) => {
      const x1 = Math.min((xs[k + 1] ?? W), W) - 1; // последний пиксель куска
      const [o1, l1, o2, l2] = GRAIN[(r * 5 + k) % GRAIN.length];
      const seg = (ox, len, dy, col) => {
        const sx = x0 + 3 + ox;
        if (sx + len - 1 <= x1 - 2) c.rect(sx, y + dy, len, 1, col);
      };
      seg(o1, l1, 5, P.deskDk);
      seg(o1 + 6, Math.max(8, l1 - 10), 10, P.deskLt);
      seg(o2, l2, 8, P.deskDk);
      seg(o2 + 12, 12, 13, P.deskLt);
    });
  }
  // --- растение справа от монитора (стоит на столе) ---
  for (let y = 172; y <= 176; y++) for (let x = 300; x < 372; x++) {
    if (inEll(x, y, 338, 175, 30, 3.2)) c.set(x, y, P.deskDk); // тень слева-вниз от света справа
  }
  blit(c, drawPlant(), 322, 114);
  return c;
}

// ---------- Монитор 150x120 (с клавиатурой) ----------
const MONITOR_SCREEN = { x: 26, y: 20, w: 98, h: 52 }; // чистая область под текст (однотонная)
// скруглённый прямоугольник (срезаны угловые пиксели)
const rr = (c, x, y, w, h, col) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = Math.min(i, w - 1 - i), dy = Math.min(j, h - 1 - j);
    if (dx + dy < 2) continue;
    c.set(x + i, y + j, col);
  }
};
function drawMonitor(on) {
  const c = new Canvas(150, 120);
  // корпус: слева темнее, справа и сверху светлее
  rr(c, 6, 2, 138, 90, P.mug);
  for (let y = 2; y < 92; y++) for (let x = 6; x < 144; x++) {
    if (!c.alpha(x, y)) continue;
    if (y >= 88) c.set(x, y, P.mugDk);
    else if (x <= 10) c.set(x, y, P.mugDk);
    else if (x >= 139 || y <= 3) c.set(x, y, P.white);
  }
  // утопленная рамка экрана
  c.rect(15, 9, 121, 75, P.mugDk);
  c.rect(15, 83, 121, 1, P.white);
  c.rect(135, 9, 1, 75, P.white);
  rr(c, 16, 10, 118, 72, P.rimDk);
  rr(c, 19, 13, 112, 66, on ? P.green : P.ink); // стекло: кромка
  c.rect(22, 16, 106, 60, on ? P.screenOn : P.ink); // однотонная область (MONITOR_SCREEN внутри неё)
  if (on) for (const [x, y] of [[22, 16], [23, 16], [22, 17], [127, 16], [126, 16], [127, 17], [22, 75], [23, 75], [22, 74], [127, 75], [126, 75], [127, 74]]) c.set(x, y, P.green);
  // блик на стекле в правом верхнем углу (вне MONITOR_SCREEN)
  for (const [x, y] of [[125, 16], [126, 17], [127, 18], [120, 16], [121, 17], [122, 18]]) c.set(x, y, on ? P.greenLt : P.rimDk);
  // подбородок: щель дисковода, табличка без текста, кнопка и светодиод
  c.rect(20, 86, 30, 2, P.rimDk);
  c.rect(20, 88, 30, 1, P.white);
  c.rect(64, 85, 16, 4, P.paper);
  c.rect(64, 88, 16, 1, P.paperDk);
  c.rect(112, 86, 8, 3, P.mugDk); c.rect(112, 86, 8, 1, P.white);
  c.rect(124, 86, 3, 2, on ? P.greenLt : P.steelDk);
  if (on) c.set(126, 86, P.glint);
  // шея и подставка
  c.rect(58, 92, 34, 6, P.mugDk);
  c.rect(88, 92, 4, 6, P.mug);
  c.rect(42, 98, 66, 8, P.mug);
  c.rect(42, 98, 66, 1, P.white);
  c.rect(42, 98, 3, 8, P.mugDk);
  c.rect(42, 104, 66, 2, P.mugDk);
  c.rect(104, 99, 4, 5, P.white);
  // клавиатура
  rr(c, 12, 108, 126, 12, P.mug);
  c.rect(12, 108, 4, 12, P.mugDk);
  c.rect(134, 109, 4, 10, P.white);
  c.rect(12, 118, 126, 2, P.mugDk);
  for (let r = 0; r < 3; r++) {
    const y = 110 + r * 3;
    if (r < 2) for (let x = 18; x <= 127; x += 5) { c.rect(x, y, 4, 1, P.white); c.rect(x, y + 1, 4, 1, P.paperDk); }
    else {
      for (let x = 18; x <= 38; x += 5) { c.rect(x, y, 4, 1, P.white); c.rect(x, y + 1, 4, 1, P.paperDk); }
      c.rect(44, y, 56, 1, P.white); c.rect(44, y + 1, 56, 1, P.paperDk);
      for (let x = 105; x <= 127; x += 5) { c.rect(x, y, 4, 1, P.white); c.rect(x, y + 1, 4, 1, P.paperDk); }
    }
  }
  c.outline(P.edge);
  return c;
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
  // лоток: задняя стенка и дно
  c.rect(0, 30, 110, 25, P.desk);
  c.rect(0, 30, 110, 2, P.deskLt);
  c.rect(3, 32, 104, 12, P.deskDk);
  c.rect(3, 32, 104, 1, P.edge);
  // штампы стоят в лотке
  const stamp = (ox, ramp) => {
    for (let y = 2; y <= 14; y++) for (let x = ox + 3; x <= ox + 25; x++) { // ручка-грибок
      if (!inEll(x, y, ox + 14, 8, 8, 6)) continue;
      c.set(x, y, x <= ox + 9 ? ramp.dk : x >= ox + 19 ? ramp.lit : ramp.mid);
    }
    c.rect(ox + 14, 6, 3, 1, ramp.lit);
    c.rect(ox + 11, 14, 7, 8, ramp.mid);
    c.rect(ox + 11, 14, 2, 8, ramp.dk);
    c.rect(ox + 16, 14, 2, 8, ramp.lit);
    c.rect(ox + 8, 21, 13, 3, ramp.dk);
    c.rect(ox + 8, 21, 13, 1, ramp.mid);
    c.rect(ox + 2, 24, 25, 15, P.cork); // деревянное основание
    c.rect(ox + 2, 24, 25, 1, P.folderLt);
    c.rect(ox + 2, 24, 3, 15, P.corkDk);
    c.rect(ox + 24, 25, 3, 14, P.folderLt);
    c.rect(ox + 3, 39, 23, 3, P.rimDk); // резина
  };
  stamp(4, { lit: P.greenLt, mid: P.green, dk: P.greenDk });
  stamp(80, { lit: P.redLt, mid: P.red, dk: P.redDk });
  // штемпельная подушка
  c.rect(39, 32, 34, 12, P.rimDk);
  c.rect(41, 34, 30, 7, P.blueDk);
  c.rect(41, 34, 30, 1, P.blue);
  c.rect(68, 35, 3, 6, P.blue);
  c.set(69, 35, P.blueLt);
  c.rect(39, 41, 34, 3, P.steelDk);
  c.rect(39, 41, 34, 1, P.steel);
  // передняя стенка лотка (перекрывает основания)
  c.rect(0, 43, 110, 12, P.desk);
  c.rect(0, 43, 110, 2, P.deskLt);
  c.rect(0, 52, 110, 3, P.deskDk);
  c.rect(0, 45, 3, 7, P.deskDk);
  c.rect(107, 45, 3, 7, P.deskLt);
  c.outline(P.edge);
  return c;
}

// ---------- Оттиски штампов 120x40: GUILTY (красный) / NOT GUILTY (зелёный); единственное место с текстом ----------
const FONT = { // блочный шрифт, высота 5 (ширина у букв разная: 3–5)
  G: ['.###', '#...', '#.##', '#..#', '.###'], U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  I: ['###', '.#.', '.#.', '.#.', '###'], L: ['#...', '#...', '#...', '#...', '####'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'], Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  ' ': ['  ', '  ', '  ', '  ', '  '],
};
const STAMP_W = 120, STAMP_H = 40;
function drawStampImpression(word, ink, inkLt) {
  const c = new Canvas(STAMP_W, STAMP_H);
  const S = 2;
  const wpx = word.split('').reduce((a, ch) => a + FONT[ch][0].length + 1, -1) * S;
  let x = Math.floor((STAMP_W - wpx) / 2);
  const y = 15;
  for (const ch of word) {
    FONT[ch].forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') c.rect(x + i * S, y + j * S, S, S, ink); }));
    x += (FONT[ch][0].length + 1) * S;
  }
  const W = STAMP_W, H = STAMP_H;
  c.rect(2, 2, W - 4, 2, ink); c.rect(2, H - 4, W - 4, 2, ink); c.rect(2, 2, 2, H - 4, ink); c.rect(W - 4, 2, 2, H - 4, ink); // внешняя рамка
  c.rect(6, 6, W - 12, 1, ink); c.rect(6, H - 7, W - 12, 1, ink); c.rect(6, 6, 1, H - 12, ink); c.rect(W - 7, 6, 1, H - 12, ink); // внутренняя
  // износ оттиска: детерминированный; сильнее у краёв рамки, слабее в середине (потёртости + неравномерная краска)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!c.alpha(i, j)) continue;
    const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
    const edgeD = Math.min(i, j, W - 1 - i, H - 1 - j);
    const wear = edgeD < 8 ? 12 : 2; // потёртость в основном у краёв рамки, текст почти чистый
    if (h % 100 < wear) c.set(i, j, [0, 0, 0, 0]);
    else if (h % 100 < wear + (edgeD < 8 ? 14 : 6)) c.set(i, j, inkLt);
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
  ['monitor.png', drawMonitor(false)],
  ['monitor_on.png', drawMonitor(true)],
  ['folder.png', drawFolder(false)],
  ['folder_open.png', drawFolder(true)],
  ['board.png', drawBoard()],
  ['stamps.png', drawStamps()],
  ['ui/stamp_guilty.png', drawStampImpression('GUILTY', P.red, P.redLt)],
  ['ui/stamp_not_guilty.png', drawStampImpression('NOT GUILTY', P.green, P.greenLt)],
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

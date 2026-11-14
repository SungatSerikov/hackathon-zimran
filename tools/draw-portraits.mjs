// Рисует вручную (попиксельно) 8 портретов 48x48 в public/assets/portraits/<id>.png. Без зависимостей.
// ВСЕГДА перезаписывает свои PNG. Стиль как у сцены: приглушённая палитра, тёмные тонированные контуры (ink),
// свет справа-сверху, альфа только 0/255. Цвета: основная палитра P + кожа из PP (tools/lib/pixel.mjs).
//
// Единая серия обеспечивается общей базой: плашка, голова, шея и плечи одинаковы у всех (таблицы HEAD_HW / SHOULDER_HW),
// линия глаз y=18, линия плеч y=36, ось симметрии между x=23 и x=24. Различаются только тон кожи, причёска,
// одежда, аксессуар и мелкие детали выражения (брови, рот).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P, PP, Canvas } from './lib/pixel.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets', 'portraits');

const SIZE = 48;
const PLATE = P.steelDk; // одна плашка-фон для всех портретов
const mx = (x) => SIZE - 1 - x; // зеркало относительно оси x=23.5

// ---------- Общая база ----------
const HEAD_TOP = 9, HEAD_BOT = 29;
const HEAD_HW = { 9: 5, 10: 7, 11: 8, 12: 9, 13: 10, 14: 10, 15: 10, 16: 10, 17: 10, 18: 10, 19: 10, 20: 10, 21: 10, 22: 10, 23: 10, 24: 9, 25: 9, 26: 8, 27: 7, 28: 6, 29: 4 };
const SHOULDER_HW = { 33: 7, 34: 11, 35: 15, 36: 18, 37: 20, 38: 21 }; // ниже — 22 (x=2..45)
const EYE_Y = 18;

const row = (c, y, hw, col) => c.rect(24 - hw, y, hw * 2, 1, col);
const mp = (c, x, y, col) => { c.set(x, y, col); c.set(mx(x), y, col); }; // симметричная пара
const rowRange = (c, y, x0, x1, col) => c.rect(x0, y, x1 - x0 + 1, 1, col);

const TONES = {
  fair: [PP.skinFair, PP.skinLight], light: [PP.skinLight, PP.skinMed], med: [PP.skinMed, PP.skinBrown],
  brown: [PP.skinBrown, P.desk], deep: [P.deskDk, P.coffee],
};
// одежда: [база, тень (слева), свет (справа)]
const CLOTH = {
  blue: [P.blue, P.blueDk, P.blueLt], navy: [P.blueDk, P.rimDk, P.blue], red: [P.red, P.redDk, P.redLt],
  green: [P.green, P.greenDk, P.greenLt], gold: [P.gold, P.folder, P.folderLt], grey: [P.steel, P.steelDk, P.paperDk],
  brownc: [P.desk, P.deskDk, P.deskLt], tan: [P.cork, P.corkDk, P.folderLt],
};

function shoulders(c, cl) {
  const [base, dk, lt] = CLOTH[cl];
  for (let y = 33; y < SIZE; y++) {
    const hw = SHOULDER_HW[y] ?? 22;
    row(c, y, hw, base);
    if (y >= 36) {
      c.rect(24 - hw, y, y === 36 ? 3 : 5, 1, dk); // тень слева
      c.rect(24 + hw - (y === 36 ? 2 : 4), y, y === 36 ? 2 : 4, 1, lt); // свет справа
    }
  }
}

function neck(c, [sk, dk], vDepth = 0) {
  for (let y = 29; y <= 35; y++) row(c, y, 4, sk);
  rowRange(c, 29, 20, 27, dk); rowRange(c, 30, 20, 27, dk); // тень от подбородка
  c.rect(20, 31, 1, 4, dk);
  if (vDepth) for (let i = 0; i < vDepth; i++) row(c, 35 + i, 4 - i - 1 > 0 ? 4 - i : 1, sk); // вырез V
}

function head(c, [sk, dk]) {
  for (const ex of [12, 34]) c.rect(ex, 17, 2, 5, sk); // уши
  c.set(12, 18, dk); c.set(12, 19, dk); c.set(12, 20, dk);
  for (let y = HEAD_TOP; y <= HEAD_BOT; y++) {
    const hw = HEAD_HW[y];
    row(c, y, hw, sk);
    c.rect(24 - hw, y, y >= 13 && y <= 26 ? 2 : 1, 1, dk); // тень слева
  }
  rowRange(c, 28, 20, 27, dk); // тень под нижней губой/подбородок слабая
  rowRange(c, 29, 20, 27, dk);
}

// брови: ключевой элемент выражения. dy — смещения по 4 пикселям (снаружи -> внутрь)
function brows(c, col, dy = [0, 0, 0, 0], y0 = 15, x0 = 17, len = 4) {
  for (let i = 0; i < len; i++) mp(c, x0 + i, y0 + (dy[i] ?? 0), col);
}
function eyes(c, { lid = false, dk = null, col = P.ink } = {}) {
  for (const x of [19, 20]) mp(c, x, EYE_Y, col);
  for (const x of [19, 20]) mp(c, x, EYE_Y + 1, col);
  c.set(20, EYE_Y, P.glint); c.set(28, EYE_Y, P.glint); // блик в правом пикселе каждого глаза: свет справа-сверху
  if (lid && dk) { for (const x of [18, 19, 20, 21]) mp(c, x, EYE_Y - 1, dk); }
}
function nose(c, dk) {
  c.set(23, 20, dk); c.set(23, 21, dk); mp(c, 23, 22, dk); mp(c, 24, 22, dk);
}
// рот: type = smile | soft | flat | grin
function mouth(c, type, col = P.redDk, y = 25) {
  if (type === 'flat') { rowRange(c, y, 21, 26, col); }
  else if (type === 'soft') { rowRange(c, y, 21, 26, col); mp(c, 20, y - 1, col); }
  else if (type === 'smile') { rowRange(c, y, 21, 26, col); mp(c, 20, y - 1, col); mp(c, 19, y - 1, col); }
  else if (type === 'low') { rowRange(c, y, 21, 26, col); mp(c, 20, y + 1, col); }
  else if (type === 'grin') {
    rowRange(c, y - 1, 20, 27, col); rowRange(c, y, 21, 26, P.white); rowRange(c, y + 1, 22, 25, col); mp(c, 19, y - 2, col); mp(c, 20, y - 2, col);
  }
}

// ---------- Описание персонажей ----------
// Каждый рисует: [тело, шея, голова, лицо, причёска/аксессуары]. Порядок слоёв важен.
const chars = {
  linda_park(c) {
    const t = TONES.light;
    // волосы сзади (длинные до плеч)
    for (let y = 9; y <= 36; y++) { const hw = y < 13 ? HEAD_HW[y] + 2 : 12; row(c, y, hw, P.ink); }
    shoulders(c, 'blue');
    // кардиган поверх белой футболки
    row(c, 35, 4, P.white); row(c, 36, 3, P.white);
    for (let y = 37; y < SIZE; y++) { rowRange(c, y, 19, 28, P.white); }
    for (let y = 37; y < SIZE; y++) { c.set(19, y, CLOTH.blue[1]); c.set(28, y, CLOTH.blue[1]); c.set(18, y, CLOTH.blue[0]); }
    c.rect(26, 40, 1, 1, P.paperDk); c.rect(26, 44, 1, 1, P.paperDk); // пуговицы
    neck(c, t);
    row(c, 35, 3, t[0]); row(c, 36, 2, t[0]);
    // волосы по бокам поверх плеч
    for (let y = 22; y <= 38; y++) { c.rect(11, y, 4, 1, P.ink); c.rect(33, y, 4, 1, P.ink); }
    head(c, t);
    // волосы: чёлка набок
    for (let y = 8; y <= 12; y++) row(c, y, Math.min(HEAD_HW[y] + 1, 11), P.ink);
    rowRange(c, 13, 14, 29, P.ink); rowRange(c, 14, 14, 24, P.ink); rowRange(c, 15, 14, 18, P.ink);
    c.rect(14, 16, 1, 7, P.ink); c.rect(33, 13, 1, 9, P.ink); c.rect(32, 13, 1, 4, P.ink);
    for (let x = 27; x <= 33; x++) c.set(x, 9, P.rimDk); c.set(30, 10, P.rimDk); c.set(31, 10, P.rimDk);
    brows(c, P.ink, [0, 0, 0, 0], 16);
    eyes(c); nose(c, t[1]);
    mp(c, 19, 20, t[1]); mp(c, 20, 20, t[1]); // усталые мешки
    mouth(c, 'soft');
  },
  dale_hughes(c) {
    const t = TONES.fair;
    shoulders(c, 'navy');
    for (let y = 33; y <= 36; y++) { rowRange(c, y, 17, 30, CLOTH.navy[1]); }
    c.rect(30, 41, 6, 4, P.paperDk); c.rect(30, 41, 6, 1, P.white); c.rect(31, 43, 4, 1, P.blue); // нашивка без текста
    neck(c, t);
    rowRange(c, 33, 19, 28, CLOTH.navy[0]); rowRange(c, 34, 18, 29, CLOTH.navy[0]);
    head(c, t);
    // кепка: купол, швы, пуговка, козырёк
    const CAP = { 5: 4, 6: 7, 7: 9, 8: 10, 9: 11, 10: 11, 11: 11 };
    for (const [y, hw] of Object.entries(CAP)) { row(c, +y, hw, P.rimDk); c.rect(24 + hw - 3, +y, 3, 1, P.steel); }
    c.rect(23, 5, 2, 1, P.steel); c.rect(23, 6, 1, 5, P.steelDk);
    c.rect(21, 7, 6, 3, P.paperDk); c.rect(22, 8, 4, 1, P.steelDk); // логотип без текста
    rowRange(c, 12, 11, 36, P.rimDk); rowRange(c, 13, 11, 36, P.ink); // козырёк
    rowRange(c, 14, 14, 33, TONES.fair[1]); // тень под козырьком
    // седые бакенбарды
    c.rect(14, 15, 1, 5, P.steel); c.rect(33, 15, 1, 5, P.steel);
    brows(c, P.steel, [0, 0, 0, 0], 16, 17, 4); brows(c, P.steel, [1, 1, 1, 1], 15, 17, 4);
    eyes(c, { lid: true, dk: t[1] }); nose(c, t[1]);
    // усы
    rowRange(c, 22, 19, 28, P.steel); rowRange(c, 23, 17, 30, P.paperDk); rowRange(c, 24, 17, 30, P.steel);
    c.set(17, 25, P.steel); c.set(30, 25, P.steel); c.set(18, 25, P.steel); c.set(29, 25, P.steel);
    rowRange(c, 23, 21, 26, P.paperDk);
    rowRange(c, 26, 21, 26, P.redDk);
    c.rect(17, 19, 1, 3, t[1]); c.rect(30, 19, 1, 3, t[1]);
  },
  tina_ruiz(c) {
    const t = TONES.med;
    // пучок
    [2, 3, 4, 5, 5, 5].forEach((hw, i) => row(c, 3 + i, hw, P.coffee)); // пучок сидит на макушке без зазора (y=3..8, дальше волосы)
    c.rect(19, 6, 1, 3, P.deskDk); c.rect(27, 4, 2, 1, P.deskLt); c.rect(28, 5, 2, 2, P.deskLt);
    shoulders(c, 'red');
    for (let y = 35; y < 39; y++) rowRange(c, y, 20 - (y - 35), 27 + (y - 35), CLOTH.red[2]); // воротник блузки
    neck(c, t, 3);
    head(c, t);
    for (let y = 9; y <= 12; y++) row(c, y, HEAD_HW[y] + 1, P.coffee);
    rowRange(c, 13, 13, 34, P.coffee); rowRange(c, 14, 14, 33, P.coffee);
    c.rect(14, 15, 1, 5, P.coffee); c.rect(33, 15, 1, 5, P.coffee);
    for (let x = 27; x <= 33; x++) c.set(x, 9, P.deskLt); c.set(30, 10, P.deskLt);
    rowRange(c, 14, 20, 24, P.coffee); // пробор
    brows(c, P.coffee, [0, -1, -1, -1], 15, 17, 4);
    eyes(c); nose(c, t[1]);
    // очки для чтения
    for (const [x0, y0] of [[16, 16], [26, 16]]) {
      rowRange(c, y0, x0, x0 + 6, P.ink); rowRange(c, y0 + 5, x0, x0 + 6, P.ink);
      c.rect(x0, y0, 1, 6, P.ink); c.rect(x0 + 6, y0, 1, 6, P.ink);
    }
    rowRange(c, 18, 22, 25, P.ink);
    c.set(22, 17, P.glint); c.set(30, 17, P.glint);
    mouth(c, 'smile');
  },
  marcus_bell(c) {
    const t = TONES.deep;
    shoulders(c, 'grey');
    // капюшон
    for (let y = 31; y <= 36; y++) { row(c, y, 9 + Math.min(y - 31, 2), CLOTH.grey[0]); }
    rowRange(c, 31, 14, 33, CLOTH.grey[1]);
    c.rect(14, 32, 3, 5, CLOTH.grey[1]);
    c.rect(31, 32, 3, 4, CLOTH.grey[2]);
    neck(c, t, 0);
    row(c, 35, 4, t[0]); row(c, 36, 3, t[0]); row(c, 37, 2, t[0]);
    rowRange(c, 38, 19, 28, CLOTH.grey[0]);
    // шнурки, карман
    c.rect(20, 38, 1, 5, P.white); c.rect(27, 38, 1, 5, P.white);
    c.rect(20, 43, 1, 1, P.paperDk); c.rect(27, 43, 1, 1, P.paperDk);
    rowRange(c, 44, 14, 33, CLOTH.grey[1]);
    head(c, t);
    for (let y = 8; y <= 12; y++) row(c, y, HEAD_HW[y] + 1, P.ink);
    rowRange(c, 13, 14, 33, P.ink);
    c.set(14, 14, P.ink); c.set(33, 14, P.ink); c.set(14, 15, P.ink); c.set(33, 15, P.ink);
    for (let x = 27; x <= 32; x++) c.set(x, 9, P.rimDk); c.set(30, 10, P.rimDk); c.set(31, 10, P.rimDk);
    brows(c, P.ink, [0, 0, 0, 0], 16, 17, 4); // ровные, чуть опущены: раздражён, не злой
    rowRange(c, 17, 18, 21, t[1]); rowRange(c, 17, 26, 29, t[1]);
    eyes(c, { lid: true, dk: t[1] }); nose(c, t[1]);
    mouth(c, 'flat', P.coffee);
  },
  priya_shah(c) {
    const t = TONES.brown;
    // волосы сзади до плеч
    for (let y = 9; y <= 35; y++) { const hw = y < 13 ? HEAD_HW[y] + 2 : 12; row(c, y, hw, P.coffee); }
    shoulders(c, 'green');
    for (let y = 35; y <= 38; y++) { rowRange(c, y, 19 - (y - 35), 28 + (y - 35), CLOTH.green[1]); } // воротник-поло
    c.rect(23, 39, 2, 5, CLOTH.green[1]); c.set(23, 40, P.white); c.set(24, 42, P.white); // планка
    neck(c, t, 3);
    for (let y = 22; y <= 36; y++) { c.rect(11, y, 3, 1, P.coffee); c.rect(34, y, 3, 1, P.coffee); }
    head(c, t);
    for (let y = 8; y <= 12; y++) row(c, y, Math.min(HEAD_HW[y] + 1, 11), P.coffee);
    rowRange(c, 13, 14, 33, P.coffee); rowRange(c, 14, 15, 32, P.coffee); rowRange(c, 14, 20, 27, P.coffee);
    c.rect(14, 14, 1, 5, P.coffee); c.rect(33, 14, 1, 5, P.coffee);
    for (let x = 27; x <= 33; x++) c.set(x, 9, P.deskLt); c.set(30, 10, P.deskLt);
    brows(c, P.coffee, [0, 0, 0, 0], 16, 17, 4);
    eyes(c); nose(c, t[1]);
    mouth(c, 'smile');
    // гарнитура: дуга, чашки, микрофон
    for (let y = 6; y <= 8; y++) row(c, y, HEAD_HW[9] + 4 + (y - 6) * 2 > 12 ? 12 : 8 + (y - 6) * 2, P.steel);
    for (let y = 9; y <= 17; y++) { c.set(mx(12), y, P.steel); c.set(12, y, P.steel); c.set(13, y, P.steel); c.set(mx(13), y, P.steel); }
    c.rect(11, 17, 3, 6, P.rimDk); c.rect(34, 17, 3, 6, P.rimDk); c.set(35, 18, P.steel);
    c.line(13, 23, 17, 26, P.rimDk); c.line(17, 26, 19, 27, P.rimDk); c.rect(19, 27, 2, 2, P.ink); c.set(19, 27, P.steel);
  },
  gloria_mendez(c) {
    const t = TONES.light;
    // пышные седые кудри сзади: комковатый силуэт + «кольца» 3x3 (тень снизу-слева, блик сверху-справа) на сетке со сдвигом
    const HAIR_HW = [4, 7, 9, 11, 12, 13, 14, 13, 14, 14, 15, 14, 14, 15, 14, 14, 15, 14, 14, 13, 14, 13, 12, 11]; // y=3..26
    const inHair = (x, y) => y >= 3 && y <= 26 && Math.abs(x - 23.5) < HAIR_HW[y - 3];
    HAIR_HW.forEach((hw, i) => row(c, 3 + i, hw, P.paperDk));
    const ring = (cx, cy) => {
      for (const [dx, dy, col] of [[-1, 1, P.steel], [0, 1, P.steel], [-1, 0, P.steel], [1, -1, P.white], [0, -1, P.white], [-1, -1, P.mugDk]]) if (inHair(cx + dx, cy + dy)) c.set(cx + dx, cy + dy, col);
    };
    for (let r = 0, cy = 5; cy <= 25; cy += 3, r++) for (let cx = 6 + (r % 2) * 2; cx <= 42; cx += 4) ring(cx, cy);
    shoulders(c, 'gold');
    // блузка: воротник и цветочный узор из приглушённых цветов
    for (let y = 35; y <= 38; y++) rowRange(c, y, 19 - (y - 35), 28 + (y - 35), P.folderLt);
    for (const [fx, fy] of [[9, 43], [37, 42], [30, 46]]) { // три цветка: лепестки redLt, серединка red, листик greenLt
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) c.set(fx + dx, fy + dy, P.redLt);
      c.set(fx, fy, P.red); c.set(fx + 2, fy + 1, P.greenLt); c.set(fx + 3, fy + 2, P.greenLt);
    }
    neck(c, t, 3);
    head(c, t);
    // кудрявая чёлка: 4 крупных завитка по лбу
    for (let y = 9; y <= 12; y++) row(c, y, HEAD_HW[y] + 1, P.paperDk);
    for (let cy = 10; cy <= 12; cy += 3) for (let cx = 15 + (cy % 2) * 2; cx <= 34; cx += 4) ring(cx, cy);
    for (const cx of [15, 20, 27, 32]) { c.rect(cx - 1, 13, 3, 1, P.paperDk); c.set(cx - 1, 13, P.steel); c.set(cx, 13, P.paperDk); c.set(cx + 1, 13, P.white); }
    c.rect(14, 14, 1, 2, P.paperDk); c.rect(33, 14, 1, 2, P.paperDk);
    brows(c, P.steel, [0, -1, -1, 0], 15, 17, 4);
    eyes(c); nose(c, t[1]);
    mouth(c, 'smile');
    mp(c, 16, 19, t[1]); mp(c, 16, 20, t[1]); // «гусиные лапки»: опыт и острый взгляд
    c.rect(11, 20, 2, 3, P.gold); c.rect(35, 20, 2, 3, P.gold); // серьги
  },
  kyle_denton(c) {
    const t = TONES.fair;
    shoulders(c, 'tan');
    // футболка в вырезе пиджака
    for (let y = 34; y < SIZE; y++) { const w = Math.min(4 + (y - 34), 7); rowRange(c, y, 24 - w, 23 + w, P.white); }
    // лацканы
    for (let y = 34; y < SIZE; y++) { const w = Math.min(4 + (y - 34), 7); c.set(24 - w - 1, y, CLOTH.tan[1]); c.set(23 + w + 1, y, CLOTH.tan[1]); c.set(24 - w - 2, y, CLOTH.tan[1]); c.set(23 + w + 2, y, CLOTH.tan[2]); }
    neck(c, t, 0);
    row(c, 35, 4, t[0]); row(c, 36, 3, t[0]); row(c, 34, 4, t[0]);
    c.rect(22, 37, 4, 1, P.paperDk);
    head(c, t);
    // зачёс назад: лоб открыт до y=12, пряди-блики идут назад
    for (let y = 9; y <= 11; y++) row(c, y, HEAD_HW[y] + 1, P.deskDk);
    row(c, 8, 5, P.deskDk); rowRange(c, 8, 26, 28, P.deskLt); // объём зачёса
    row(c, 12, 7, P.deskDk); c.rect(14, 12, 2, 3, P.deskDk); c.rect(32, 12, 2, 3, P.deskDk); // висок
    rowRange(c, 9, 25, 31, P.deskLt); rowRange(c, 10, 19, 28, P.deskLt); rowRange(c, 11, 16, 21, P.deskLt); rowRange(c, 11, 26, 31, P.desk);
    rowRange(c, 12, 20, 22, P.desk); rowRange(c, 10, 30, 32, P.desk);
    brows(c, P.coffee, [0, -1, -1, -1], 15, 17, 4);
    eyes(c); nose(c, t[1]);
    mouth(c, 'grin');
    mp(c, 17, 22, t[1]); mp(c, 17, 23, t[1]); // улыбчатые складки
  },
  ray_ortiz(c) {
    const t = TONES.med;
    shoulders(c, 'brownc');
    // воротник-поло и планка
    for (let y = 35; y <= 38; y++) rowRange(c, y, 19 - (y - 35), 28 + (y - 35), CLOTH.brownc[1]);
    c.rect(23, 39, 2, 6, CLOTH.brownc[1]); c.set(23, 40, P.paperDk); c.set(24, 43, P.paperDk);
    c.rect(13, 41, 6, 4, P.white); c.rect(13, 41, 6, 1, P.paperDk); c.rect(14, 43, 3, 1, P.steelDk); // бейдж без текста
    neck(c, t, 3);
    head(c, t);
    for (let y = 9; y <= 12; y++) row(c, y, HEAD_HW[y] + 1, P.ink);
    row(c, 8, 5, P.ink); // чуть длиннее сверху
    rowRange(c, 13, 17, 30, P.ink); // залысины: виски открыты
    c.rect(21, 8, 1, 3, P.rimDk); c.rect(20, 11, 1, 1, P.rimDk); // пробор
    for (let x = 28; x <= 31; x++) c.set(x, 8, P.rimDk); for (let x = 27; x <= 32; x++) c.set(x, 10, P.rimDk);
    brows(c, P.ink, [0, 0, 0, 0], 15, 17, 4);
    eyes(c); nose(c, t[1]);
    mp(c, 19, 20, t[1]); mp(c, 20, 20, t[1]); mp(c, 19, 21, t[1]); // мешки под глазами
    for (const [x, y] of [[16, 25], [18, 27], [20, 28], [22, 28], [17, 26], [24, 28], [26, 28], [27, 28], [29, 27], [31, 25], [30, 26]]) c.set(x, y, t[1]); // щетина
    mouth(c, 'soft');
  },
};

// ---------- Сборка ----------
function render(id) {
  const fig = new Canvas(SIZE, SIZE);
  chars[id](fig);
  fig.outline(P.ink); // тёмный тонированный контур вокруг всей фигуры
  const out = new Canvas(SIZE, SIZE);
  out.rect(0, 0, SIZE, SIZE, PLATE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (fig.alpha(x, y)) out.d.set(fig.d.subarray((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4), (y * SIZE + x) * 4);
  return out;
}

export const ids = Object.keys(chars);
export const targets = ids.map((id) => [`${id}.png`, render(id)]);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  for (const [name, canvas] of targets) {
    writeFileSync(join(OUT, name), canvas.png());
    console.log(`  * portraits/${name} (${canvas.w}x${canvas.h})`);
  }
}

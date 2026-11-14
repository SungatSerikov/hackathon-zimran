// Рисует вручную: ui/logo.png (латунная табличка с названием, 200x60) и ui/menu_bg.png (вечерний фон меню, 480x270).
// Без зависимостей. ВСЕГДА перезаписывает свои PNG. Запускать ПОСЛЕ tools/draw-sprites.mjs (фон меню собирается из его спрайтов в памяти,
// поэтому всегда совпадает с актуальным артом сцены; сам скрипт файлы спрайтов не читает и не меняет).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P, Canvas } from './lib/pixel.mjs';
import { drawText, textWidth, FONT_H } from './lib/font.mjs';
import { targets as spriteTargets } from './draw-sprites.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'public', 'assets');

// ======== Название на табличке: меняется ТОЛЬКО здесь ========
// Поддерживаются A–Z (регистр не важен), 0–9, пробел и . , - ! ? : ' & + /  (см. tools/lib/font.mjs); любой другой символ рисуется как «?».
export const LOGO_TEXT = 'CASE DESK';

// ---------- Логотип 200x60 ----------
const LOGO_W = 200, LOGO_H = 60;
const BRASS = { hi: P.folderLt, base: P.gold, mid: P.folder, lo: P.corkDk, edge: P.edge };

// Подбор размера: самый крупный масштаб S (5..1), при котором текст влезает в TEXT_MAX_W; сначала зазор между буквами S px,
// затем уменьшается до max(1, S-2) px. Если не влезает даже при S=1 и зазоре 1 — ошибка (слишком длинное название).
const TEXT_MAX_W = 164;
function fitText(text) {
  if (![...text].length) throw new Error('LOGO_TEXT пустой');
  for (let S = 5; S >= 1; S--) for (let gap = S; gap >= Math.max(1, S - 2); gap--) {
    if (textWidth(text, S, gap) <= TEXT_MAX_W) return { S, gap, w: textWidth(text, S, gap) };
  }
  throw new Error(`LOGO_TEXT слишком длинный для таблички: "${text}"`);
}

function drawLogo(text) {
  const W = LOGO_W, H = LOGO_H;
  const c = new Canvas(W, H);
  // форма: прямоугольник со срезанными углами (прозрачно вокруг)
  const cut = [3, 1, 1];
  for (let y = 0; y < H; y++) {
    const dy = Math.min(y, H - 1 - y);
    const inset = dy < 3 ? cut[dy] : 0;
    c.rect(inset, y, W - inset * 2, 1, BRASS.base);
  }
  // фаска: свет сверху и справа, тень слева и снизу
  for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
    if (!c.alpha(x, y)) continue;
    const dl = x, dr = W - 1 - x, dt = y, db = H - 1 - y, d = Math.min(dl, dr, dt, db);
    if (d > 2) continue;
    c.set(x, y, dt === d || dr === d ? BRASS.hi : BRASS.lo);
  }
  c.rect(4, 4, W - 8, H - 8, BRASS.base);
  // «шлифовка» латуни: короткие горизонтальные штрихи 2–4 px (детерминированно)
  for (let y = 5; y < H - 5; y++) for (let x = 5; x < W - 9; x++)
    if ((x * 7 + y * 13) % 53 === 0) c.rect(x, y, 2 + ((x + y) % 3), 1, BRASS.mid);
  // вдавленная рамка на лицевой панели (свет сверху-справа: тёмные верх и правый край, светлые низ и левый)
  const fx = 9, fy = 9, fw = W - 18, fh = H - 18;
  c.rect(fx, fy, fw, 1, BRASS.lo); c.rect(fx + fw - 1, fy, 1, fh, BRASS.lo); // тёмные верх и правый край (свет сверху-справа)
  c.rect(fx, fy + fh - 1, fw - 1, 1, BRASS.hi); c.rect(fx, fy + 1, 1, fh - 1, BRASS.hi); // светлые низ и левый
  // винты по углам (3x3: сталь, шлиц, блик справа-сверху)
  for (const [sx, sy] of [[5, 5], [W - 8, 5], [5, H - 8], [W - 8, H - 8]]) {
    c.rect(sx, sy, 3, 3, P.steel);
    c.rect(sx, sy + 2, 3, 1, P.steelDk); c.rect(sx, sy, 1, 3, P.steelDk);
    c.rect(sx + 1, sy + 1, 1, 1, P.rimDk);
    c.set(sx + 2, sy, P.glint);
  }
  // текст: гравировка (тёмная буква, светлый край справа-снизу), по центру
  const { S, gap, w } = fitText(text);
  const x0 = Math.floor((W - w) / 2), y0 = Math.floor((H - FONT_H * S) / 2);
  drawText(c, text, x0 - 1, y0 + 1, S, gap, BRASS.hi); // светлый край гравировки слева-снизу
  drawText(c, text, x0, y0, S, gap, BRASS.edge);
  c.outline(P.edge); // тёмный тонированный контур по границе таблички
  return c;
}

// ---------- Фон меню 480x270 ----------
const W = 480, H = 270;
const layout = JSON.parse(readFileSync(join(ROOT, 'src', 'scene', 'layout.json'), 'utf8'));
const spriteMap = new Map(spriteTargets.map(([n, canvas]) => [n.includes('/') ? n : `scene/${n}`, canvas]));
// не рисуем в меню: папку с делом (лежит прямо за кнопками)
const MENU_SKIP = new Set(['folder']);

function composeScene() {
  const c = new Canvas(W, H);
  const bg = spriteMap.get(layout.background);
  c.d.set(bg.d);
  const objs = layout.objects.filter((o) => !MENU_SKIP.has(o.id)).map((o, i) => ({ o, i })).sort((a, b) => a.o.z - b.o.z || a.i - b.i);
  for (const { o } of objs) {
    const s = spriteMap.get(o.sprite);
    if (!s) throw new Error(`нет спрайта ${o.sprite}`);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.alpha(x, y)) c.set(o.x + x, o.y + y, s.d.subarray((y * s.w + x) * 4, (y * s.w + x) * 4 + 4));
  }
  return c;
}

const PALETTE = Object.values(P);
const nearest = (r, g, b) => {
  let best = PALETTE[0], bd = Infinity;
  for (const p of PALETTE) { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const clamp = (v) => Math.max(0, Math.min(255, v));

// Вечерняя цветокоррекция. Каждый пиксель приводится к ближайшему цвету палитры P (цвета только из P).
// Дизеринг (Bayer 4x4) выбирает всегда между ДВУМЯ уже готовыми цветами палитры (соседние ступени), а не добавляет шум к RGB.
// 1) сумрак: холодный синий множитель; 2) свет настольной лампы слева: 3 тёплые ступени вокруг лампы, узкий дизер-обод на стыке ступеней;
// 3) спокойная зона под кнопки: вертикальная полоса x 144..316 (границы идут по пустой стене/столу между полкой, монитором и доской)
//    затемняется целиком, переход 16 px, тоже выбором из двух цветов.
const DUSK = [0.44, 0.5, 0.7];
const LIGHT_LEVELS = [DUSK, [0.6, 0.58, 0.62], [0.78, 0.72, 0.7], [1.0, 0.9, 0.8], [1.2, 1.1, 0.95]]; // сумрак -> тёплые ступени к лампе (4 шага, внешний край гаснет мягко)
const LAMP_C = { x: 52, y: 205, rx: 86, ry: 40 }; // центр пятна прямо под открытым краем абажура (см. drawLamp)
const SHADE = { x: 51, y: 178 }; // нижний центр абажура: отсюда вниз идёт конус света
const CALM = { x0: 144, x1: 316, feather: 16, dim: 0.6 };
function drawMenuBg() {
  const src = composeScene();
  const out = new Canvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i4 = (y * W + x) * 4, r = src.d[i4], g = src.d[i4 + 1], b = src.d[i4 + 2];
    const th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    // ступень света: f 0..3, дизер только в средней трети каждой ступени (узкий обод)
    const lamp = Math.max(0, 1 - Math.hypot((x - LAMP_C.x) / LAMP_C.rx, (y - LAMP_C.y) / LAMP_C.ry));
    // конус света от абажура вниз к пятну: добавляет до ступени ~1.8
    const cy = y - SHADE.y, cw = 6 + cy * 0.75;
    const cone = cy > 0 && cy < 40 ? Math.max(0, 1 - Math.abs(x - SHADE.x - cy * 0.1) / cw) * 1.8 * (1 - cy / 40) : 0;
    const f = Math.min(4, Math.max(lamp * 4.4, cone)), lvl = Math.min(3, Math.floor(f));
    const p = Math.max(0, Math.min(1, ((f - lvl) - 0.5) * 4 + 0.5));
    const k = p > th ? LIGHT_LEVELS[lvl + 1] : LIGHT_LEVELS[lvl];
    const dx = Math.max(CALM.x0 - x, 0, x - CALM.x1);
    const calm = Math.max(0, 1 - dx / CALM.feather);
    const dim = calm > th ? CALM.dim : 1;
    out.set(x, y, nearest(clamp(r * k[0] * dim), clamp(g * k[1] * dim), clamp(b * k[2] * dim)));
  }
  drawLamp(out);
  return out;
}

// настольная лампа на шарнирах (стоит НА столе слева, не задевает спрайты телефона и кружек): тяжёлое основание, нижнее и верхнее
// колено, шарнир, абажур наклонён вниз-вправо и висит над точкой (38..58, 165..178); под открытым краем светится лампочка.
function drawLamp(dst) {
  const c = new Canvas(W, H); // отдельный прозрачный холст, чтобы обвести контуром только лампу
  const thick = (x0, y0, x1, y1) => { // колено 4 px: тёмная левая половина, светлая правая
    c.line(x0 - 1, y0, x1 - 1, y1, P.steelDk); c.line(x0, y0, x1, y1, P.steelDk);
    c.line(x0 + 1, y0, x1 + 1, y1, P.steel); c.line(x0 + 2, y0, x1 + 2, y1, P.steel);
  };
  // основание: широкое и тяжёлое
  c.rect(5, 220, 28, 7, P.rimDk); c.rect(9, 216, 20, 4, P.rimDk);
  c.rect(5, 220, 28, 1, P.steelDk); c.rect(9, 216, 20, 1, P.steelDk); c.rect(29, 221, 3, 5, P.steelDk);
  // нижнее колено вверх-вправо, шарнир, верхнее колено к абажуру
  thick(17, 216, 30, 194);
  c.rect(27, 191, 8, 8, P.steelDk); c.rect(28, 192, 6, 6, P.steel); c.rect(30, 194, 2, 2, P.rimDk); // шарнир-колено
  thick(30, 192, 42, 172);
  c.rect(14, 212, 8, 6, P.steelDk); c.rect(15, 213, 6, 4, P.steel); c.rect(17, 214, 2, 2, P.rimDk); // нижний шарнир над основанием
  // абажур: усечённый конус, наклон вниз-вправо, висит над (40..58, 165..176)
  for (let j = 0; j < 12; j++) {
    const x0 = 38 + Math.round(j * 0.6), x1 = 48 + Math.round(j * 0.8);
    c.rect(x0, 165 + j, x1 - x0 + 1, 1, P.gold);
    c.rect(x0, 165 + j, 2, 1, P.corkDk);
    c.rect(x1 - 2, 165 + j, 3, 1, P.folderLt);
  }
  c.rect(38, 165, 11, 1, P.folderLt); // верхний блик
  c.rect(45, 175, 12, 1, P.corkDk); c.rect(45, 176, 12, 1, P.corkDk); // нижний срез абажура
  c.rect(47, 177, 8, 1, P.folderLt); c.rect(49, 178, 4, 1, P.folderLt); // лампочка: свет под абажуром
  c.outline(P.edge);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (c.alpha(x, y)) dst.set(x, y, c.d.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));
}

// ---------- Запись ----------
export const targets = [['ui/logo.png', drawLogo(LOGO_TEXT)], ['ui/menu_bg.png', drawMenuBg()]];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [rel, canvas] of targets) {
    mkdirSync(dirname(join(ASSETS, rel)), { recursive: true });
    writeFileSync(join(ASSETS, rel), canvas.png());
    console.log(`  * ${rel} (${canvas.w}x${canvas.h})`);
  }
}

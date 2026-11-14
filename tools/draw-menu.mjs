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
// Композиция фона меню (отдельная от layout.json): слева (x<~170) весь текст меню рисует код поверх тёмного градиента,
// поэтому там нет предметов; справа ~65% — стол. Координаты — левый верх спрайта на холсте 480x270.
const BG_SHIFT = 26; // фон сцены сдвигается вправо (с заворотом справа налево): окно и монитор встают над одним местом в правой части
const MENU_OBJECTS = [
  ['scene/board.png', 330, 24], // под кнопкой звука (сверху справа) — она остаётся над доской
  ['scene/monitor.png', 176, 40],
  ['scene/safe.png', 345, 118],
  ['scene/folder.png', 196, 178],
  ['scene/stamps.png', 352, 186], // ниже подписи «YOUR NEXT CASE IS WAITING» снизу справа остаётся полоса
];
const LAMP_AT = { dx: 412, dy: -44 }; // зеркальная настольная лампа у правого края; пятно света на сейфе и столе

function composeScene() {
  const c = new Canvas(W, H);
  const bg = new Canvas(W, H);
  bg.d.set(spriteMap.get(layout.background).d);
  // фон сцены уже содержит контактные тени под предметами в позициях layout.json — в меню предметы стоят иначе, поэтому тени стираем
  // (заменяем пикселем чистой столешницы из колонки x=476, где предметов нет) и рисуем свои под новыми позициями
  const CONTACT = ['monitor', 'safe', 'folder', 'stamps'];
  const shadowPixels = (name, ox, oy) => {
    const sp = spriteMap.get(name), pts = [];
    for (let x = 0; x < sp.w; x++) {
      let bottom = -1;
      for (let y = 0; y < sp.h; y++) if (sp.alpha(x, y)) bottom = y;
      if (bottom >= 0) pts.push([ox + x - 2, oy + bottom + 1], [ox + x - 2, oy + bottom + 2], [ox + x - 2, oy + bottom + 3]);
    }
    return pts;
  };
  const clean = (x, y) => bg.d.set(bg.d.subarray((y * W + 476) * 4, (y * W + 476) * 4 + 4), (y * W + x) * 4);
  for (const o of layout.objects) if (CONTACT.includes(o.id)) for (const [x, y] of shadowPixels(o.sprite, o.x, o.y)) if (x >= 0 && x < 476 && y >= 112 && y < 262) clean(x, y);
  // убираем растение из фона (оно стояло справа от монитора): копируем доски с соседнего куска стола на 112 px левее (период стыков досок)
  for (let y = 110; y < 190; y++) for (let x = 296; x < 380; x++) bg.d.set(bg.d.subarray((y * W + x - 112) * 4, (y * W + x - 112) * 4 + 4), (y * W + x) * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = (x - BG_SHIFT + W) % W;
    c.d.set(bg.d.subarray((y * W + sx) * 4, (y * W + sx) * 4 + 4), (y * W + x) * 4);
  }
  // контактные тени под предметами в новых позициях (стиль как в bg: смещены на 2 px влево, edge + deskDk)
  for (const [name, ox, oy] of MENU_OBJECTS) {
    if (!CONTACT.some((id) => name.endsWith(`/${id}.png`))) continue;
    const pts = shadowPixels(name, ox, oy);
    pts.forEach(([x, y], i) => { const k = i % 3; if (k === 0) c.set(x, y, P.edge); else if (k === 1) c.set(x, y, P.deskDk); else if (x % 2 === 0) c.set(x, y, P.deskDk); });
  }
  // предметы рисуем поверх теней
  for (const [name, ox, oy] of MENU_OBJECTS) {
    const s = spriteMap.get(name);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.alpha(x, y)) c.set(ox + x, oy + y, s.d.subarray((y * s.w + x) * 4, (y * s.w + x) * 4 + 4));
  }
  return c;
}

const PALETTE = Object.values(P);
const WARM_PALETTE = Object.entries(P).filter(([k]) => !/^green|^screenOn/.test(k)).map(([, v]) => v); // в тёплом свете лампы зелёные тона не подходят (сталь иначе становится зелёной)
const nearest = (r, g, b, warm = false) => {
  let best = PALETTE[0], bd = Infinity;
  for (const p of warm ? WARM_PALETTE : PALETTE) { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const clamp = (v) => Math.max(0, Math.min(255, v));

// Вечерняя цветокоррекция. Каждый пиксель приводится к ближайшему цвету палитры P (цвета только из P).
// Дизеринг (Bayer 4x4) выбирает всегда между ДВУМЯ уже готовыми цветами палитры (соседние ступени), а не добавляет шум к RGB.
// 1) сумрак: холодный синий множитель; 2) свет настольной лампы справа: 4 тёплые ступени вокруг лампы, узкий дизер-обод;
// 3) левая колонка под текст меню: широкий плавный градиент затемнения (6 ступеней), слева плоский тёмный тон.
const DUSK = [0.44, 0.5, 0.7];
const LIGHT_LEVELS = [DUSK, [0.6, 0.58, 0.62], [0.78, 0.72, 0.7], [1.0, 0.9, 0.8], [1.2, 1.1, 0.95]]; // сумрак -> тёплые ступени к лампе
// центр пятна под открытым краем абажура (абажур лампы после отражения и сдвига LAMP_AT)
const LAMP_C = { x: LAMP_AT.dx + 11, y: 205 + LAMP_AT.dy, rx: 86, ry: 40 };
const SHADE = { x: LAMP_AT.dx + 12, y: 178 + LAMP_AT.dy };
const SHADE_DIM = [1, 0.8, 0.62, 0.48, 0.38, 0.3]; // ступени затемнения слева (1 = без затемнения)
const SHADE_X = { full: 118, none: 196 }; // до x=118 самый тёмный тон, к x=196 сцена без затемнения
function drawMenuBg() {
  const src = composeScene();
  const out = new Canvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i4 = (y * W + x) * 4, r = src.d[i4], gg = src.d[i4 + 1], b = src.d[i4 + 2];
    const th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    const lamp = Math.max(0, 1 - Math.hypot((x - LAMP_C.x) / LAMP_C.rx, (y - LAMP_C.y) / LAMP_C.ry));
    const cy = y - SHADE.y, cw = 6 + cy * 0.75;
    const cone = cy > 0 && cy < 40 ? Math.max(0, 1 - Math.abs(x - SHADE.x + cy * 0.1) / cw) * 1.8 * (1 - cy / 40) : 0;
    const f = Math.min(4, Math.max(lamp * 4.4, cone)), lvl = Math.min(3, Math.floor(f));
    const p = Math.max(0, Math.min(1, ((f - lvl) - 0.5) * 4 + 0.5));
    const k = p > th ? LIGHT_LEVELS[lvl + 1] : LIGHT_LEVELS[lvl];
    // градиент слева: g 0..1 (1 — полностью тёмная колонка); ступень выбирается между двумя соседними значениями SHADE_DIM
    const gr = Math.max(0, Math.min(1, (SHADE_X.none - x) / (SHADE_X.none - SHADE_X.full)));
    const gf = gr * (SHADE_DIM.length - 1), gi = Math.min(SHADE_DIM.length - 2, Math.floor(gf));
    const dim = gf - gi > th ? SHADE_DIM[gi + 1] : SHADE_DIM[gi];
    out.set(x, y, nearest(clamp(r * k[0] * dim), clamp(gg * k[1] * dim), clamp(b * k[2] * dim), k !== LIGHT_LEVELS[0] && k !== LIGHT_LEVELS[1]));
  }
  drawLamp(out, LAMP_AT);
  return out;
}

// настольная лампа на шарнирах, ЗЕРКАЛЬНО (абажур смотрит влево, на стол и сейф): тяжёлое основание, нижнее и верхнее колено,
// шарнир, абажур наклонён вниз; под открытым краем светится лампочка. Рисуется в локальных координатах (абажур над x 38..58, y 165..178),
// затем отражается (x -> 63 - x) и сдвигается на (dx, dy).
function drawLamp(dst, { dx, dy }) {
  const c = new Canvas(64, H); // отдельный прозрачный холст, чтобы обвести контуром только лампу
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
  for (let y = 0; y < H; y++) for (let x = 0; x < 64; x++) if (c.alpha(x, y)) dst.set(dx + (63 - x), y + dy, c.d.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 4));
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

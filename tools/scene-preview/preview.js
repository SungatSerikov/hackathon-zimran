'use strict';
// Превью сцены: рисует layout.json, позволяет двигать предметы и сохранять раскладку.

const LAYOUT_URL = '/src/scene/layout.json';
const ASSETS = '/public/assets/';

// Переключатели состояний: id предметов, суффикс файла-состояния.
const STATE_DEFS = [
  { key: 'folder', title: 'Папка открыта', ids: ['folder'], suffix: '_open' },
  { key: 'coffee', title: 'Кофе пустой', ids: ['coffee_1', 'coffee_2', 'coffee_3'], suffix: '_empty' },
  { key: 'safe', title: 'Сейф открыт', ids: ['safe'], suffix: '_open' },
  { key: 'monitor', title: 'Монитор включён', ids: ['monitor'], suffix: '_on' },
];

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const wrap = $('stage-wrap');

let layout = null;
let bust = Date.now();
let scale = 1;
let selectedId = null;
let hoverId = null;
let dragging = null;
let dirty = false;
let panelId = null;
const exists = new Map(); // url -> boolean
const stateOn = {}; // key -> boolean

const assetUrl = (p) => ASSETS + p + '?t=' + bust;
const stateSprite = (sprite, suffix) => sprite.replace(/\.png$/i, suffix + '.png');

function loadImage(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = assetUrl(path);
  });
}

function msg(text) {
  $('msg').textContent = text;
  clearTimeout(msg.t);
  msg.t = setTimeout(() => { $('msg').textContent = ''; }, 4000);
}

async function load() {
  bust = Date.now();
  let data;
  try {
    const r = await fetch(LAYOUT_URL + '?t=' + bust, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    data = await r.json();
  } catch (e) {
    msg('Не удалось загрузить layout.json: ' + e.message);
    return;
  }
  layout = data;
  layout.objects = layout.objects || [];
  dirty = false;
  if (!layout.objects.some((o) => o.id === selectedId)) selectedId = null;
  exists.clear();
  const paths = new Set([layout.background]);
  for (const o of layout.objects) {
    paths.add(o.sprite);
    for (const d of STATE_DEFS) if (d.ids.includes(o.id)) paths.add(stateSprite(o.sprite, d.suffix));
  }
  await Promise.all([...paths].filter(Boolean).map(async (p) => exists.set(p, await loadImage(p))));
  buildStateControls();
  render();
  checkBounds();
  syncPanel();
}

function currentSprite(o) {
  for (const d of STATE_DEFS) {
    if (d.ids.includes(o.id) && stateOn[d.key]) {
      const s = stateSprite(o.sprite, d.suffix);
      if (exists.get(s)) return s;
    }
  }
  return o.sprite;
}

function buildStateControls() {
  const box = $('states');
  box.textContent = '';
  let any = false;
  for (const d of STATE_DEFS) {
    const has = layout.objects.some((o) => d.ids.includes(o.id) && exists.get(stateSprite(o.sprite, d.suffix)));
    if (!has) { stateOn[d.key] = false; continue; }
    any = true;
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!stateOn[d.key];
    cb.addEventListener('change', () => { stateOn[d.key] = cb.checked; render(); });
    label.append(cb, ' ' + d.title);
    box.append(label);
  }
  if (!any) box.textContent = 'Файлов состояний нет (folder_open, coffee_empty, safe_open, monitor_on).';
}

function computeScale() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  scale = Math.max(1, Math.floor(Math.min(w / layout.base.w, h / layout.base.h)));
}

function render() {
  if (!layout) return;
  computeScale();
  stage.textContent = '';
  stage.style.width = layout.base.w * scale + 'px';
  stage.style.height = layout.base.h * scale + 'px';

  if (layout.background && exists.get(layout.background)) {
    const bg = document.createElement('img');
    bg.className = 'bg';
    bg.src = assetUrl(layout.background);
    stage.append(bg);
  }
  for (const o of layout.objects) {
    const el = document.createElement('div');
    el.className = 'obj';
    el.dataset.id = o.id;
    const sprite = currentSprite(o);
    if (exists.get(sprite)) {
      const img = document.createElement('img');
      img.src = assetUrl(sprite);
      img.alt = o.id;
      el.append(img);
    } else {
      el.classList.add('missing');
      el.textContent = o.id;
    }
    el.addEventListener('pointerdown', (e) => onDown(e, o, el));
    el.addEventListener('pointerenter', () => { hoverId = o.id; refreshMarks(); });
    el.addEventListener('pointerleave', () => { if (hoverId === o.id) hoverId = null; refreshMarks(); });
    stage.append(el);
  }
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.id = 'tip';
  tip.hidden = true;
  stage.append(tip);
  positionAll();
  refreshMarks();
}

function positionAll() {
  for (const el of stage.querySelectorAll('.obj')) {
    const o = layout.objects.find((q) => q.id === el.dataset.id);
    el.style.left = o.x * scale + 'px';
    el.style.top = o.y * scale + 'px';
    el.style.width = o.w * scale + 'px';
    el.style.height = o.h * scale + 'px';
    el.style.zIndex = o.z ?? 0;
  }
  updateTip();
}

function refreshMarks() {
  for (const el of stage.querySelectorAll('.obj')) {
    el.classList.toggle('hover', el.dataset.id === hoverId);
    el.classList.toggle('selected', el.dataset.id === selectedId);
    el.classList.toggle('dragging', !!dragging && el.dataset.id === dragging.o.id);
  }
  updateTip();
}

function updateTip() {
  const tip = $('tip');
  if (!tip) return;
  const o = layout.objects.find((q) => q.id === hoverId);
  if (!o) { tip.hidden = true; return; }
  tip.hidden = false;
  tip.textContent = o.label || o.id;
  const top = o.y * scale;
  tip.style.left = o.x * scale + 'px';
  if (top < 20) { tip.style.top = (o.y + o.h) * scale + 18 + 'px'; } else { tip.style.top = top + 'px'; }
}

function onDown(e, o, el) {
  if (e.button !== 0) return;
  e.preventDefault();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  selectedId = o.id;
  dragging = { o, el, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y };
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  refreshMarks();
  syncPanel();
}
function onMove(e) {
  if (!dragging) return;
  dragging.o.x = dragging.ox + Math.round((e.clientX - dragging.sx) / scale);
  dragging.o.y = dragging.oy + Math.round((e.clientY - dragging.sy) / scale);
  dirty = true;
  positionAll();
  syncPanel();
}
function onUp(e) {
  if (!dragging) return;
  const el = dragging.el;
  el.removeEventListener('pointermove', onMove);
  el.removeEventListener('pointerup', onUp);
  el.removeEventListener('pointercancel', onUp);
  dragging = null;
  refreshMarks();
}

function selected() { return layout && layout.objects.find((o) => o.id === selectedId); }

function syncPanel() {
  const o = selected();
  $('sel').hidden = !o;
  $('sel-none').hidden = !!o;
  if (!o) return;
  $('f-id').textContent = o.id;
  const idChanged = panelId !== o.id;
  panelId = o.id;
  for (const k of ['x', 'y', 'w', 'h']) {
    const inp = $('f-' + k);
    if (idChanged || document.activeElement !== inp) inp.value = o[k];
  }
  checkBounds();
}

function checkBounds() {
  const bad = layout.objects.filter((o) => o.x < 0 || o.y < 0 || o.x + o.w > layout.base.w || o.y + o.h > layout.base.h);
  $('warn').textContent = bad.length ? 'Вне сцены ' + layout.base.w + '×' + layout.base.h + ': ' + bad.map((o) => o.id).join(', ') : '';
}

for (const k of ['x', 'y', 'w', 'h']) {
  $('f-' + k).addEventListener('input', (e) => {
    const o = selected();
    const v = parseInt(e.target.value, 10);
    if (!o || Number.isNaN(v)) return;
    o[k] = k === 'w' || k === 'h' ? Math.max(1, v) : v;
    dirty = true;
    positionAll();
    checkBounds();
  });
  $('f-' + k).addEventListener('blur', syncPanel);
}

document.addEventListener('keydown', (e) => {
  const o = selected();
  if (!o || (e.target instanceof Element && e.target.matches('input[type=number], input[type=text], textarea'))) return;
  const step = e.shiftKey ? 10 : 1;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!d) return;
  e.preventDefault();
  o.x += d[0]; o.y += d[1];
  dirty = true;
  positionAll();
  syncPanel();
});

// Клик по пустому месту снимает выбор
stage.addEventListener('pointerdown', (e) => {
  if (e.target === stage || e.target.classList.contains('bg')) { selectedId = null; refreshMarks(); syncPanel(); }
});

$('chk-hitbox').addEventListener('change', (e) => document.body.classList.toggle('hitbox', e.target.checked));
$('btn-reload').addEventListener('click', async () => {
  if (dirty && !confirm('Несохранённые правки раскладки будут потеряны. Перечитать?')) return;
  await load();
  msg('Перечитано');
});
$('btn-panel').addEventListener('click', () => {
  const hidden = $('panel').classList.toggle('collapsed');
  $('btn-panel').textContent = hidden ? '☰' : '✕';
  if (layout) render();
});
window.addEventListener('resize', () => { if (layout) render(); });

// Экспорт в формате layout.json
function exportJson() {
  const fmt = (o) => '{ ' + Object.entries(o).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(', ') + ' }';
  const lines = [
    '{',
    '  "base": ' + fmt(layout.base) + ',',
    '  "background": ' + JSON.stringify(layout.background) + ',',
    '  "objects": [',
    layout.objects.map((o) => '    ' + fmt(o)).join(',\n'),
    '  ]',
    '}',
  ];
  return lines.join('\n') + '\n';
}

$('btn-download').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
  a.download = 'layout.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  dirty = false;
  msg('Скачано. Положите файл в src/scene/layout.json');
});

$('btn-copy').addEventListener('click', async () => {
  const text = exportJson();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  msg('JSON скопирован');
});

load();

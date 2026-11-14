# ASSET_PROMPTS — промпты для генерации ассетов

Как пользоваться: к каждому промпту **всегда** добавляй общий стилевой префикс (STYLE). Генерируй, затем по шагам из `ASSETS.md` §5: уменьшить без сглаживания до целевого размера → привести к одной палитре → подчистить → вырезать фон.

Совет: сначала сгенерируй `bg` и 1 предмет, утверди стиль, потом остальное — с тем же seed / тем же референсом **собственного** сгенерированного фона (не скриншотов чужих игр).

## STYLE (префикс ко всему)

```
pixel art, crisp hard pixel edges, no anti-aliasing, limited 32-color palette,
clean modern pixel art style, muted desaturated palette: warm light greys, beige, soft charcoal, walnut wood, silver and white, muted green accents,
soft low-contrast shading in 2-3 steps, no pure black outlines (dark tinted outlines), calm daylight office, cozy small-town American office, clean readable shapes, game asset,
no text, no letters, no logos, no watermark
```

Для отдельных предметов добавляй: `single object, centered, plain flat magenta background (#FF00FF)` — потом магенту легко вырезать в прозрачность.

## Сцена

| Файл | Промпт (после STYLE) | Итоговый размер |
|---|---|---|
| `scene/bg.png` | `front view of an empty walnut wood office desk against a light warm grey wall, subtle wall panelling and skirting board, a wide window with soft daylight and a city skyline, desk top occupies the bottom 60% of the image, empty spaces for objects, wide 16:9 composition` | 480×270 |
| `ui/menu_bg.png` | тот же промпт, + `dimmed, slightly darker and bluer tint` | 480×270 |

## Предметы стола

| Файл | Промпт (после STYLE + single object) | Размер | Состояния |
|---|---|---|---|
| `scene/monitor.png` | `chunky off-white 1990s CRT computer monitor with keyboard in front, soft shading, dark charcoal-teal screen, small power LED, front view` | ~150×120 | off: экран тёмный; on: мягкое сине-зелёное свечение (`monitor_on.png`) |
| `scene/folder.png` | `manila case folder lying on a desk seen from slightly above, tab, steel paper clip, blank label patch, a few sheet edges sticking out, muted colors` | ~140×80 | closed / open (`folder_open.png`: раскрытая, две пустые страницы) |
| `scene/clock.png` | `round wall clock with simple face, dark wooden rim, no hands` | ~36×36 | стрелки рисует код |
| `scene/calendar.png` | `tear-off wall calendar, muted green header strip with metal rings, torn paper remnants, blank off-white page` | ~44×52 | число рисует код |
| `scene/coffee.png` | `white ceramic coffee mug full of black coffee, small steam` | ~24×28 | `coffee_empty.png`: та же кружка пустая, без пара |
| `scene/stamps.png` | `small walnut wood tray with two rubber stamps, one with muted green handle (NOT GUILTY), one with muted red handle (GUILTY), blue ink pad` | ~110×55 | — |
| `scene/safe.png` | `small steel office safe with muted green painted door, round combination dial, side handle, hinges and small feet, closed, front view` | ~70×60 | `safe_open.png`: дверца распахнута, внутри стопки зелёных банкнот с бумажными лентами (без цифр) |
| `scene/phone.png` | `classic office push-button desk telephone, dark charcoal wedge-shaped body, sloped front keypad panel with 12 light buttons and a few function keys, small green indicator light, light grey dog-bone handset resting in the cradle, coiled cord, soft shadow on the desk, front view slightly from above` | 56×40 | `phone_ring.png`: трубка приподнята над вилкой, светодиод горит ярко, короткие штрихи звонка по бокам |
| `scene/cabinet.png` | `wall-mounted wooden shelf with a row of archive binders, spines in muted green, beige, steel blue, muted red and walnut, blank label patches, two binders with small brass padlocks, front view` | 110×40 | — |
| `scene/board.png` | `cork board on the wall in a slim walnut frame, calm cork texture, a few colored pins and two small blank paper scraps` | ~150×80 | карточки улик рисует код |

## UI

| Файл | Промпт | Размер |
|---|---|---|
| `ui/stamp_guilty.png` | `rubber stamp ink impression, double rectangular border, muted red ink, slightly worn edges, blocky pixel letters spelling GUILTY` | 120×40 |
| `ui/stamp_not_guilty.png` | то же, `muted green ink, NOT GUILTY` | 120×40 |
| `ui/claim_form.png` | `complaint form on off-white paper, green header strip with a small shield emblem, three empty ruled rows, no text` | ~200×120 |
| `ui/paper.png` | `seamless tileable texture of slightly yellowed office paper, subtle grain` | 64×64 |
| `ui/sticker_new.png` | `small yellow sticky note, slightly curled corner` | 16×16 |
| `ui/logo.png` | `game logo plaque, brass nameplate style, empty for text` (текст логотипа добавить вручную пиксельным шрифтом) | ~200×60 |

> Генераторы плохо пишут слова. Для штампов надёжнее: сгенерировать пустую рамку штампа, а слова GUILTY / NOT GUILTY набрать шрифтом `Silkscreen` в Pixelorama.

## Портреты персонажей (48×48)

Префикс для всех портретов, после STYLE:
```
character portrait, head and shoulders, front facing, plain flat background #2B2B3A,
consistent portrait series style, expressive face, 48x48 sprite feel
```

### Учебное дело — The Double Charge

| Файл | Персонаж | Промпт |
|---|---|---|
| `portraits/linda_park.png` | Linda Park, клиентка | `Korean-American woman in her late 30s, shoulder-length black hair, cardigan, tired but determined look` |
| `portraits/dale_hughes.png` | Dale Hughes, владелец сантехнической фирмы | `white man in his 50s, gray mustache, navy work shirt with name patch, baseball cap, gruff` |
| `portraits/tina_ruiz.png` | Tina Ruiz, бухгалтер фирмы | `Latina woman in her early 30s, hair in a neat bun, reading glasses, polite office smile, slightly nervous eyes` |

### Основное дело — The Missing Refund

| Файл | Персонаж | Промпт |
|---|---|---|
| `portraits/marcus_bell.png` | Marcus Bell, клиент | `Black man in his early 30s, short hair, hoodie, frustrated expression, phone in hand` |
| `portraits/priya_shah.png` | Priya Shah, поддержка Northwind | `South Asian woman in her late 20s, headset, branded green polo shirt, calm professional look` |
| `portraits/gloria_mendez.png` | Gloria Mendez, соседка | `Mexican-American woman in her 60s, gray curly hair, colorful blouse, kind but sharp look` |
| `portraits/kyle_denton.png` | Kyle Denton, владелец QuickShip | `white man in his mid 30s, slicked hair, cheap blazer over t-shirt, overly friendly salesman smile` |
| `portraits/ray_ortiz.png` | Ray Ortiz, клерк ParcelGo | `Latino man in his 40s, brown delivery-store uniform polo, name tag, friendly tired face` |

Подсказка для единого стиля: генерируй все портреты одной сессией, с одинаковым префиксом и одинаковым фоном; виновника **не** делай заметно «злодейским» — иначе дело решается по картинке.

## Звуки (P2, бесплатно)

Сгенерировать в **jsfxr** (sfxr.me): `stamp.wav` (Hit/Hurt, низкий), `paper.wav` (Noise, короткий), `type.wav` (Blip), `found.wav` (Pickup/Coin), `error.wav` (Hit, высокий). Положить в `public/assets/sounds/`.

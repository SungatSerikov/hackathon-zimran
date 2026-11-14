# ASSET_PROMPTS — промпты для генерации ассетов

Как пользоваться: к каждому промпту **всегда** добавляй общий стилевой префикс (STYLE). Генерируй, затем по шагам из `ASSETS.md` §5: уменьшить без сглаживания до целевого размера → привести к одной палитре → подчистить → вырезать фон.

Совет: сначала сгенерируй `bg` и 1 предмет, утверди стиль, потом остальное — с тем же seed / тем же референсом **собственного** сгенерированного фона (не скриншотов чужих игр).

## STYLE (префикс ко всему)

```
pixel art, crisp hard pixel edges, no anti-aliasing, limited 32-color palette,
warm evening office lighting from a desk lamp, muted browns and teal-green accents,
cozy small-town American 1990s-era office, clean readable shapes, game asset,
no text, no letters, no logos, no watermark
```

Для отдельных предметов добавляй: `single object, centered, plain flat magenta background (#FF00FF)` — потом магенту легко вырезать в прозрачность.

## Сцена

| Файл | Промпт (после STYLE) | Итоговый размер |
|---|---|---|
| `scene/bg.png` | `front view of an empty wooden office desk against a wall, wallpaper with subtle stripes, window with night street light on the left, desk lamp on the right edge, desk top occupies the bottom 60% of the image, empty spaces for objects, wide 16:9 composition` | 480×270 |
| `ui/menu_bg.png` | тот же промпт, + `dark blue night tint, rain on the window` | 480×270 |

## Предметы стола

| Файл | Промпт (после STYLE + single object) | Размер | Состояния |
|---|---|---|---|
| `scene/monitor.png` | `beige 1990s CRT computer monitor with keyboard in front, slightly angled, screen dark green-black and empty` | ~150×120 | off: экран тёмный; on: экран с лёгким зелёным свечением |
| `scene/folder.png` | `manila case folder lying flat on a desk, paper clip, a few sheets sticking out` | ~140×80 | closed / open (`folder_open.png`: раскрытая, видны листы) |
| `scene/clock.png` | `round wall clock with simple face, dark wooden rim, no hands` | ~36×36 | стрелки рисует код |
| `scene/calendar.png` | `tear-off wall calendar, red header strip, blank white page` | ~44×52 | число рисует код |
| `scene/coffee.png` | `white ceramic coffee mug full of black coffee, small steam` | ~24×28 | `coffee_empty.png`: та же кружка пустая, без пара |
| `scene/stamps.png` | `small wooden tray with two rubber stamps, one with green handle, one with red handle, ink pad` | ~110×55 | — |
| `scene/safe.png` | `small heavy steel office safe with dial and handle, dark green paint` | ~70×60 | `safe_open.png`: дверца приоткрыта, внутри папки |
| `scene/board.png` | `cork board on the wall with a few empty pins, wooden frame` | ~150×80 | карточки улик рисует код |

## UI

| Файл | Промпт | Размер |
|---|---|---|
| `ui/stamp_approved.png` | `rubber stamp ink impression, rectangular border, green ink, rough grungy edges, the word APPROVED` | ~96×40 |
| `ui/stamp_denied.png` | то же, `red ink, the word DENIED` | ~96×40 |
| `ui/paper.png` | `seamless tileable texture of slightly yellowed office paper, subtle grain` | 64×64 |
| `ui/sticker_new.png` | `small yellow sticky note, slightly curled corner` | 16×16 |
| `ui/logo.png` | `game logo plaque, brass nameplate style, empty for text` (текст логотипа добавить вручную пиксельным шрифтом) | ~200×60 |

> Генераторы плохо пишут слова. Для штампов надёжнее: сгенерировать пустую рамку штампа, а слово APPROVED / DENIED набрать шрифтом `Silkscreen` в Pixelorama.

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
